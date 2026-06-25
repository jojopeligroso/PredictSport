import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateReckonsCopy,
  formatScoreForCopy,
} from "@/lib/reckons-copy";
import { fixtureFilterFromIds } from "@/lib/tournament/shared-fixtures";

/**
 * POST /api/chat/post-reckons
 *
 * Lazy post-lock reckons trigger. The first user to visit the picks page after
 * an event locks triggers this endpoint (fire-and-forget). It batch-posts
 * "reckons" system messages for all predictions with confidence on recently
 * locked events.
 *
 * Dedup: checks for existing `[reckons:{eventId}]` messages per user+event
 * before inserting. Subsequent calls are no-ops.
 *
 * Body: { competition_id: string }
 */
export async function POST(request: NextRequest) {
  // H3: Validate caller is authenticated or a cron job
  const cronSecret = request.headers.get("x-cron-secret");
  const isValidCron =
    cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isValidCron) {
    // Require authenticated user session
    const { createClient } = await import("@/lib/supabase/server");
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { competition_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const competitionId = body.competition_id;
  if (!competitionId) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceClient();

    // 1. Find events that locked within the last 24 hours
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: compRow } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", competitionId)
      .single();
    const ff = fixtureFilterFromIds(competitionId, compRow?.tournament_id);

    const { data: lockedEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, event_name")
      .eq(ff.key, ff.value)
      .lte("lock_time", now.toISOString())
      .gte("lock_time", windowStart.toISOString())
      .limit(100);

    if (eventsError || !lockedEvents?.length) {
      return NextResponse.json({ posted: 0 });
    }

    let totalPosted = 0;

    for (const event of lockedEvents) {
      const tag = `[reckons:${event.id}]`;

      // 2. Check if reckons already exist for this event (any user)
      const { count: existingCount } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competitionId)
        .eq("message_type", "system_reckons")
        .like("content", `${tag}%`)
        .limit(1);

      if (existingCount && existingCount > 0) {
        continue; // Already posted for this event
      }

      // 3. Fetch all predictions with confidence for this event
      const { data: predictions } = await supabase
        .from("predictions")
        .select(
          "user_id, prediction_type, prediction_data, confidence_level, event_id",
        )
        .eq("event_id", event.id)
        .not("confidence_level", "is", null)
        .gte("confidence_level", 4)
        .limit(500);

      if (!predictions?.length) continue;

      // 4. Fetch display names for all users with predictions
      const userIds = [...new Set(predictions.map((p) => p.user_id))];
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", userIds);

      const nameMap = new Map(
        (users ?? []).map((u) => [u.id, u.display_name ?? "Someone"]),
      );

      // 5. Generate reckons messages. Only process winner predictions —
      //    reckons copy is designed around "X reckons Team Y" format.
      const winnerPredictions = predictions.filter(
        (p) => p.prediction_type === "winner",
      );

      const messagesToInsert: Array<{
        competition_id: string;
        user_id: string;
        content: string;
        message_type: string;
      }> = [];

      for (const pred of winnerPredictions) {
        const data = pred.prediction_data as Record<string, unknown>;
        const predictedTeam = (data?.value as string) ?? "";
        if (!predictedTeam) continue;

        const displayName = nameMap.get(pred.user_id) ?? "Someone";
        const drawLabels = ["Draw", "draw", "Empate", "empate"];
        const isDraw = drawLabels.includes(predictedTeam);

        // Check for paired exact_score prediction
        const scorePred = predictions.find(
          (p) =>
            p.user_id === pred.user_id &&
            p.prediction_type === "exact_score" &&
            p.event_id === pred.event_id,
        );
        const scoreData = scorePred?.prediction_data as Record<
          string,
          unknown
        > | null;
        const scoreCopy = formatScoreForCopy(
          scoreData?.home as number | undefined,
          scoreData?.away as number | undefined,
        );

        const result = generateReckonsCopy({
          name: displayName,
          team: predictedTeam,
          score: scoreCopy || undefined,
          confidence: pred.confidence_level!,
          isDraw,
        });

        if (result) {
          messagesToInsert.push({
            competition_id: competitionId,
            user_id: pred.user_id,
            content: `${tag} ${result.text}`,
            message_type: "system_reckons",
          });
        }
      }

      // 6. Batch insert
      if (messagesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert(messagesToInsert);

        if (insertError) {
          console.error(
            `[post-reckons] Insert failed for event ${event.id}:`,
            insertError.message,
          );
        } else {
          totalPosted += messagesToInsert.length;
        }
      }
    }

    return NextResponse.json({ posted: totalPosted });
  } catch (err) {
    console.error(
      "[post-reckons] Error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ posted: 0 });
  }
}
