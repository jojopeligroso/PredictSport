import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDisplayName } from "@/lib/require-display-name";
import {
  postReckonsChatMessage,
  removeReckonsChatMessage,
} from "@/lib/notifications/reckons-chat";

interface PredictionRequestBody {
  event_id?: string;
  competition_id?: string;
  prediction_type?: string;
  prediction_data?: Record<string, unknown>;
  note_text?: string;
  note_visibility?: "public" | "private";
  expected_updated_at?: string;
  confidence_level?: number | null;
}

const VALID_PREDICTION_TYPES = [
  "winner",
  "top_n",
  "final_standings",
  "head_to_head",
  "margin",
  "over_under",
  "handicap",
  "yes_no",
  "progression",
  "exact_score",
] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  // Parse body
  let body: PredictionRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    event_id,
    competition_id,
    prediction_type,
    prediction_data,
    note_text,
    note_visibility,
    expected_updated_at,
    confidence_level,
  } = body;

  // Validate required fields
  if (!event_id || !competition_id || !prediction_type || !prediction_data) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: event_id, competition_id, prediction_type, prediction_data",
      },
      { status: 400 },
    );
  }

  // Validate prediction type
  if (
    !VALID_PREDICTION_TYPES.includes(
      prediction_type as (typeof VALID_PREDICTION_TYPES)[number],
    )
  ) {
    return NextResponse.json(
      { error: `Invalid prediction type: ${prediction_type}` },
      { status: 400 },
    );
  }

  // Resolve event_prediction_type + event in one round-trip. The embedded
  // event lets us also sanity-check competition_id and surface a useful error
  // before we hand the write to RLS. RLS itself enforces membership, lock_time,
  // competition.status='active', and allow_prediction_updates — so the
  // previous separate membership/competition/event/lock pre-checks were
  // redundant latency. They added ~4 round-trips per tap and contributed to
  // the "selection is too slow" feel.
  const { data: ept, error: eptError } = await supabase
    .from("event_prediction_types")
    .select(
      "id, event:events!inner(id, competition_id, tournament_id, lock_time, status, sport)",
    )
    .eq("event_id", event_id)
    .eq("prediction_type", prediction_type)
    .maybeSingle();

  if (eptError || !ept) {
    return NextResponse.json(
      {
        error: `Prediction type "${prediction_type}" is not configured for this event`,
      },
      { status: 400 },
    );
  }

  const eptEvent = (
    ept as unknown as {
      event: {
        id: string;
        competition_id: string;
        tournament_id: string | null;
        lock_time: string;
        status: string;
        sport: string;
      };
    }
  ).event;

  if (eptEvent.competition_id !== competition_id) {
    // For tournament events, verify user's competition shares the same blueprint
    if (!eptEvent.tournament_id) {
      return NextResponse.json(
        { error: "Event not found in this competition" },
        { status: 404 },
      );
    }
    const { data: userComp } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", competition_id)
      .single();
    if (userComp?.tournament_id !== eptEvent.tournament_id) {
      return NextResponse.json(
        { error: "Event not found in this competition" },
        { status: 404 },
      );
    }
  }

  if (new Date(eptEvent.lock_time) <= new Date()) {
    return NextResponse.json(
      {
        error: "This event is locked. Predictions can no longer be submitted.",
      },
      { status: 403 },
    );
  }

  if (eptEvent.status !== "upcoming") {
    return NextResponse.json(
      {
        error: `Event status is "${eptEvent.status}". Predictions can only be submitted for upcoming events.`,
      },
      { status: 403 },
    );
  }

  const event_prediction_type_id = ept.id;

  // Handle clear/delete request (e.g., removing exact_score prediction). This
  // is the only branch that still needs a separate existence read — DELETE
  // doesn't have an upsert analogue and we want a 200 (not an error) if the
  // row was never there in the first place.
  if (prediction_data._clear === true) {
    const { error: deleteError } = await supabase
      .from("predictions")
      .delete()
      .eq("event_prediction_type_id", event_prediction_type_id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete prediction" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true });
  }

  // ── Match predictions (winner / exact_score): atomic RPC ──────────────
  // The upsert_match_prediction RPC handles winner+score as a pair inside
  // one transaction with row-level locking. Score is always source of truth:
  //   - set_winner: re-derives from existing score if one exists
  //   - set_score: atomically writes score + derived winner
  // Eliminates the TOCTOU race the old re-derivation chain had.
  if (prediction_type === "winner" || prediction_type === "exact_score") {
    // Fetch both EPTs for this event so the RPC can lock/write both rows.
    const { data: matchEpts } = await supabase
      .from("event_prediction_types")
      .select("id, prediction_type, config")
      .eq("event_id", event_id)
      .in("prediction_type", ["winner", "exact_score"]);

    const winnerEptRow = matchEpts?.find(
      (e) => e.prediction_type === "winner",
    );
    const scoreEptRow = matchEpts?.find(
      (e) => e.prediction_type === "exact_score",
    );

    if (!winnerEptRow) {
      return NextResponse.json(
        { error: "Winner prediction type not configured for this event" },
        { status: 400 },
      );
    }

    const opts = (winnerEptRow.config as Record<string, unknown> | null)
      ?.options as string[] | undefined;
    const winnerOptions = opts && opts.length > 0 ? opts : [];

    const operation =
      prediction_type === "winner" ? "set_winner" : "set_score";

    const { data: result, error: rpcError } = await supabase.rpc(
      "upsert_match_prediction",
      {
        p_event_id: event_id,
        p_user_id: user.id,
        p_winner_ept_id: winnerEptRow.id,
        p_score_ept_id: scoreEptRow?.id ?? null,
        p_winner_options: winnerOptions,
        p_operation: operation,
        p_winner_value:
          prediction_type === "winner"
            ? (prediction_data as { value: string }).value
            : null,
        p_home_score:
          prediction_type === "exact_score"
            ? Number(prediction_data.home)
            : null,
        p_away_score:
          prediction_type === "exact_score"
            ? Number(prediction_data.away)
            : null,
        p_confidence_level: confidence_level ?? null,
      },
    );

    if (rpcError) {
      console.error("[predictions] upsert_match_prediction failed:", {
        event_id,
        user_id: user.id,
        operation,
        error: rpcError,
      });
      return NextResponse.json(
        { error: "Couldn't save that pick. Please try again." },
        { status: 500 },
      );
    }

    const rpcResult = result as Record<string, unknown> | null;

    if (!rpcResult || rpcResult.blocked) {
      return NextResponse.json(
        {
          error:
            "Can't save that pick — the match may have locked or updates are disabled.",
        },
        { status: 403 },
      );
    }

    // Return the primary prediction + correction metadata for conflict UX.
    const primaryPrediction =
      prediction_type === "winner" ? rpcResult.winner : rpcResult.score;

    // Fire-and-forget: post reckons chat message when confidence is set
    if (
      prediction_type === "winner" &&
      confidence_level != null &&
      rpcResult.server_winner
    ) {
      const predictedTeam = rpcResult.server_winner as string;
      const drawLabels = ["Draw", "draw", "Empate", "empate"];
      postReckonsChatMessage({
        userId: user.id,
        competitionId: competition_id!,
        eventId: event_id!,
        predictedTeam,
        confidenceLevel: confidence_level,
        isDraw: drawLabels.includes(predictedTeam),
      }).catch(() => {}); // swallow — best effort
    } else if (prediction_type === "winner" && confidence_level == null) {
      // Confidence removed — clean up any existing reckons message
      removeReckonsChatMessage({
        userId: user.id,
        competitionId: competition_id!,
        eventId: event_id!,
      }).catch(() => {});
    }

    return NextResponse.json({
      prediction: primaryPrediction,
      corrected: rpcResult.corrected ?? false,
      server_winner: rpcResult.server_winner ?? null,
    });
  }

  // ── All other prediction types: existing safe_upsert path ─────────────
  const { data: rpcRows, error: upsertError } = await supabase.rpc(
    "safe_upsert_prediction",
    {
      p_ept_id: event_prediction_type_id,
      p_user_id: user.id,
      p_type: prediction_type,
      p_event_id: event_id,
      p_data: prediction_data,
      p_expected_updated_at: expected_updated_at ?? null,
      p_note_text: note_text ?? null,
      p_note_visibility: note_visibility ?? null,
      p_confidence_level: confidence_level ?? null,
    },
  );

  if (upsertError) {
    return NextResponse.json(
      { error: "Couldn't save that pick. Please try again." },
      { status: 500 },
    );
  }

  const saved = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

  if (!saved) {
    const status = expected_updated_at ? 409 : 403;
    const error = expected_updated_at
      ? "Your pick was modified in another session. Please refresh and try again."
      : "Can't save that pick — the match may have locked or updates are disabled for this competition.";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ prediction: saved });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { event_id } = body as {
    event_id?: string;
  };

  if (!event_id) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  // Verify event exists and is not locked
  const { data: event } = await supabase
    .from("events")
    .select("lock_time, status, competition_id")
    .eq("id", event_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (new Date(event.lock_time) <= new Date() || event.status !== "upcoming") {
    return NextResponse.json({ error: "Event is locked" }, { status: 403 });
  }

  // Fetch both match EPTs so the atomic RPC can delete both rows
  const { data: matchEpts } = await supabase
    .from("event_prediction_types")
    .select("id, prediction_type")
    .eq("event_id", event_id)
    .in("prediction_type", ["winner", "exact_score"]);

  const winnerEpt = matchEpts?.find((e) => e.prediction_type === "winner");
  const scoreEpt = matchEpts?.find((e) => e.prediction_type === "exact_score");

  if (winnerEpt) {
    // Use atomic RPC to delete both winner + score in one transaction
    const { error: rpcError } = await supabase.rpc(
      "upsert_match_prediction",
      {
        p_event_id: event_id,
        p_user_id: user.id,
        p_winner_ept_id: winnerEpt.id,
        p_score_ept_id: scoreEpt?.id ?? null,
        p_operation: "reset",
      },
    );

    if (rpcError) {
      console.error("Failed to reset prediction:", rpcError);
      return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
    }

    // Clean up any reckons chat message for this event
    if (event.competition_id) {
      removeReckonsChatMessage({
        userId: user.id,
        competitionId: event.competition_id,
        eventId: event_id,
      }).catch(() => {});
    }
  } else {
    // No winner EPT — fall back to direct delete for non-match events
    const { error } = await supabase
      .from("predictions")
      .delete()
      .eq("event_id", event_id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to reset prediction:", error);
      return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
