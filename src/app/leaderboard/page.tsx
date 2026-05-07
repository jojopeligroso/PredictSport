import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompetitionSelector } from "./CompetitionSelector";
import {
  LeaderboardTable,
  type LeaderboardEntry,
  type EventPrediction,
  type TiebreakerInfo,
} from "./LeaderboardTable";

interface PageProps {
  searchParams: Promise<{ competition?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch competitions the user belongs to
  const { data: memberships } = await supabase
    .from("competition_members")
    .select("competition_id, competitions(id, name, status)")
    .eq("user_id", user.id);

  const competitions = (memberships ?? [])
    .map((m) => {
      const comp = m.competitions as unknown as {
        id: string;
        name: string;
        status: string;
      } | null;
      return comp ? { id: comp.id, name: comp.name, status: comp.status } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (competitions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">The Sheet</p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions joined yet
        </div>
      </div>
    );
  }

  // Determine selected competition
  const selectedId =
    params.competition && competitions.some((c) => c.id === params.competition)
      ? params.competition
      : competitions[0]?.id ?? null;

  if (!selectedId) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">The Sheet</p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions joined yet
        </div>
      </div>
    );
  }

  const selectedCompetition = competitions.find((c) => c.id === selectedId);

  // Fetch all data in parallel
  const [
    { data: members },
    { data: events },
    { data: tiebreakers },
  ] = await Promise.all([
    supabase
      .from("competition_members")
      .select("user_id, users(id, display_name, avatar_url)")
      .eq("competition_id", selectedId),
    supabase
      .from("events")
      .select("id, event_name, sport, status, result_data")
      .eq("competition_id", selectedId)
      .eq("status", "resulted"),
    supabase
      .from("tiebreakers")
      .select("id, question_text, correct_value")
      .eq("competition_id", selectedId),
  ]);

  const memberList = members ?? [];
  const eventList = events ?? [];
  const tiebreakerList = tiebreakers ?? [];

  const eventIds = eventList.map((e) => e.id);

  // Fetch predictions for resulted events (if any)
  let predictionList: Array<{
    id: string;
    event_id: string;
    user_id: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
    submitted_at: string;
  }> = [];

  if (eventIds.length > 0) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select(
        "id, event_id, user_id, prediction_data, is_correct, is_partial, points_awarded, submitted_at"
      )
      .in("event_id", eventIds);
    predictionList = predictions ?? [];
  }

  // Fetch tiebreaker answers
  const tiebreakerIds = tiebreakerList.map((t) => t.id);
  let tiebreakerAnswerList: Array<{
    tiebreaker_id: string;
    user_id: string;
    value: number;
  }> = [];

  if (tiebreakerIds.length > 0) {
    const { data: tbAnswers } = await supabase
      .from("tiebreaker_answers")
      .select("tiebreaker_id, user_id, value")
      .in("tiebreaker_id", tiebreakerIds);
    tiebreakerAnswerList = tbAnswers ?? [];
  }

  // Build a map of event_id -> event details
  const eventMap = new Map(
    eventList.map((e) => [
      e.id,
      {
        event_name: e.event_name,
        sport: e.sport,
        result_data: e.result_data as Record<string, unknown> | null,
      },
    ])
  );

  // Build predictions grouped by user
  const predictionsByUser = new Map<string, EventPrediction[]>();
  for (const p of predictionList) {
    const ev = eventMap.get(p.event_id);
    if (!ev) continue;
    const list = predictionsByUser.get(p.user_id) ?? [];
    list.push({
      event_id: p.event_id,
      event_name: ev.event_name,
      sport: ev.sport,
      prediction_data: p.prediction_data,
      result_data: ev.result_data,
      is_correct: p.is_correct,
      is_partial: p.is_partial,
      points_awarded: p.points_awarded,
    });
    predictionsByUser.set(p.user_id, list);
  }

  // Build tiebreaker info per user (use the first tiebreaker if multiple)
  const primaryTiebreaker = tiebreakerList[0] ?? null;
  const tiebreakerByUser = new Map<string, TiebreakerInfo>();
  if (primaryTiebreaker) {
    // Index answers by user
    const answersByUser = new Map<string, number>();
    for (const a of tiebreakerAnswerList) {
      if (a.tiebreaker_id === primaryTiebreaker.id) {
        answersByUser.set(a.user_id, a.value);
      }
    }

    for (const m of memberList) {
      const userObj = m.users as unknown as {
        id: string;
        display_name: string;
        avatar_url: string | null;
      } | null;
      if (!userObj) continue;
      const answer = answersByUser.get(userObj.id) ?? null;
      const distance =
        primaryTiebreaker.correct_value !== null && answer !== null
          ? Math.abs(answer - primaryTiebreaker.correct_value)
          : null;

      tiebreakerByUser.set(userObj.id, {
        question_text: primaryTiebreaker.question_text,
        correct_value: primaryTiebreaker.correct_value,
        user_answer: answer,
        distance,
      });
    }
  }

  // Calculate streak: consecutive correct predictions from the most recent
  function calculateStreak(predictions: EventPrediction[]): number {
    // Sort by event name as a proxy (ideally would sort by event date)
    // We reverse so most recent is first
    const sorted = [...predictions]
      .filter((p) => p.is_correct !== null)
      .reverse();
    let streak = 0;
    for (const p of sorted) {
      if (p.is_correct === true) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = memberList.map((m) => {
    const userObj = m.users as unknown as {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;

    const userId = userObj?.id ?? m.user_id;
    const displayName = userObj?.display_name ?? "Unknown";
    const avatarUrl = userObj?.avatar_url ?? null;
    const preds = predictionsByUser.get(userId) ?? [];

    const totalPoints = preds.reduce((sum, p) => sum + p.points_awarded, 0);
    const correctCount = preds.filter((p) => p.is_correct === true).length;
    const partialCount = preds.filter(
      (p) => p.is_correct === false && p.is_partial === true
    ).length;
    const resultedPreds = preds.filter((p) => p.is_correct !== null);
    const wrongCount = resultedPreds.length - correctCount - partialCount;
    const accuracy =
      resultedPreds.length > 0
        ? (correctCount / resultedPreds.length) * 100
        : 0;
    const streak = calculateStreak(preds);

    return {
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      rank: 0, // assigned below
      total_points: totalPoints,
      correct_count: correctCount,
      partial_count: partialCount,
      wrong_count: wrongCount,
      total_predictions: preds.length,
      accuracy,
      streak,
      tiebreaker: tiebreakerByUser.get(userId) ?? null,
      predictions: preds,
    };
  });

  // Sort: total points desc, then tiebreaker distance asc (lower is better)
  entries.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    // Tiebreaker: closer to correct value wins
    const aDist = a.tiebreaker?.distance ?? Infinity;
    const bDist = b.tiebreaker?.distance ?? Infinity;
    return aDist - bDist;
  });

  // Assign ranks (tied users share the same rank)
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      entries[i]!.rank = 1;
    } else {
      const prev = entries[i - 1]!;
      const curr = entries[i]!;
      const samePoints = curr.total_points === prev.total_points;
      const sameTiebreaker =
        (curr.tiebreaker?.distance ?? Infinity) ===
        (prev.tiebreaker?.distance ?? Infinity);

      if (samePoints && sameTiebreaker) {
        curr.rank = prev.rank;
      } else {
        currentRank = i + 1;
        curr.rank = currentRank;
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">
            The Sheet
            {selectedCompetition ? ` · ${selectedCompetition.name}` : ""}
          </p>
          <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
            THE TABLE
          </h1>
        </div>
        <CompetitionSelector
          competitions={competitions.map((c) => ({ id: c.id, name: c.name }))}
          selectedId={selectedId}
        />
      </div>

      <div className="mt-4">
        <LeaderboardTable entries={entries} />
      </div>
    </div>
  );
}
