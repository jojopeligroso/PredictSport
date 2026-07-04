import { scorePrediction, buildScoreDerivedWinnerOverrides } from "@/lib/scoring";
import { getTimingForSport } from "@/lib/sports/timing";
import type { PredictionType } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LiveScore {
  homeScore: number;
  awayScore: number;
  status: string;
  fetchedAt: string;
  periods?: Record<string, { home: number; away: number }>;
  ftScore?: { home: number; away: number };
}

export interface LiveEvent {
  id: string;
  sport: string;
  start_time: string;
  result_data: Record<string, unknown> | null;
}

export interface LiveEpt {
  event_id: string;
  prediction_type: string;
  points: number;
  partial_points: number;
  config: Record<string, unknown> | null;
}

export interface LivePrediction {
  user_id: string;
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

export interface LiveOverlayResult {
  hasLiveEvents: boolean;
  liveEventIds: string[];
  livePredictions: LivePrediction[];
}

export interface LiveOverlayOptions {
  userIds: string[];
  pointsMap: Map<string, number>;
  tournamentId: string | null;
  competitionId: string;
  activeSportingStageId: string | null;
  isFormat: boolean;
}

// ── Pure scoring logic (testable without Supabase) ───────────────────────────

/**
 * Given live events, their prediction types, and user predictions, compute
 * provisional points and add them to pointsMap. Returns the list of event IDs
 * that had live scores.
 *
 * This is the pure inner loop — no I/O, fully testable.
 */
export function computeLivePoints(
  liveEvents: LiveEvent[],
  eptRows: LiveEpt[],
  predictions: LivePrediction[],
  pointsMap: Map<string, number>,
): string[] {
  const scoredEventIds: string[] = [];

  for (const event of liveEvents) {
    const liveData = event.result_data?.live as LiveScore | undefined;
    if (
      !liveData ||
      typeof liveData.homeScore !== "number" ||
      typeof liveData.awayScore !== "number"
    ) {
      continue;
    }

    scoredEventIds.push(event.id);

    // Detect extra time / penalties from the live status.
    // TheSportsDB reports status as "ET", "AET", "PEN", or a minute
    // number (e.g. "105"). Minutes > 90 indicate extra time.
    // ESPN doesn't provide strStatus at all — falls back to "LIVE" for
    // all in-progress matches. Use elapsed wall-time as a fallback:
    // a soccer match with halftime + stoppage = ~110-115 min. If the
    // match has been running > 115 min, it's almost certainly in ET.
    const status = (liveData.status ?? "").toUpperCase();
    const elapsedMinutes =
      (Date.now() - new Date(event.start_time).getTime()) / 60_000;
    const isExtraTime =
      status === "ET" ||
      status === "AET" ||
      status === "PEN" ||
      (/^\d+$/.test(status) && Number(status) > 90) ||
      (event.sport === "soccer" && elapsedMinutes > 115);

    // During extra time, use the snapshotted FT score (captured by
    // the live cron during regulation) instead of the AET aggregate.
    // This makes BOTH scoreExactScore and scoreWinner work correctly:
    // exact_score compares against the FT score, winner derives "draw"
    // from equal scores.
    const useScore = isExtraTime && liveData.ftScore
      ? liveData.ftScore
      : { home: liveData.homeScore, away: liveData.awayScore };

    const scoreObj: Record<string, unknown> = {
      home_score: useScore.home,
      away_score: useScore.away,
    };

    if (isExtraTime && !liveData.ftScore) {
      // No FT snapshot available — add a synthetic periods marker
      // so scoreWinner at least derives "draw". scoreExactScore will
      // use the aggregate (imprecise but better than nothing).
      scoreObj.periods = liveData.periods ?? {
        extra_time: { home: 0, away: 0 },
      };
    }

    const resultData: Record<string, unknown> = { score: scoreObj };

    const epts = eptRows.filter((r) => r.event_id === event.id);
    const eptMap = new Map(epts.map((r) => [r.prediction_type, r]));
    const eventPreds = predictions.filter((p) => p.event_id === event.id);

    // Score is source of truth: derive each user's implied winner from
    // their exact-score pick before scoring the winner prediction.
    const winnerOpts =
      ((eptMap.get("winner")?.config as Record<string, unknown> | null)
        ?.options as string[] | undefined) ?? [];
    const winnerOverrides = buildScoreDerivedWinnerOverrides(
      eventPreds,
      winnerOpts,
      event.sport,
    );

    for (const pred of eventPreds) {
      const ept = eptMap.get(pred.prediction_type);
      if (!ept) continue;

      let predData = pred.prediction_data;
      if (pred.prediction_type === "winner") {
        const override = winnerOverrides.get(pred.user_id);
        if (override) predData = override;
      }

      try {
        const scored = scorePrediction(
          pred.prediction_type as PredictionType,
          predData,
          resultData,
          {
            points: ept.points,
            partial_points: ept.partial_points,
            config: ept.config,
          },
        );
        if (scored.points_awarded > 0) {
          pointsMap.set(
            pred.user_id,
            (pointsMap.get(pred.user_id) ?? 0) + scored.points_awarded,
          );
        }
      } catch (err) {
        console.error(
          `[live-overlay] scoring error for user=${pred.user_id} event=${event.id} type=${pred.prediction_type}:`,
          err,
        );
      }
    }
  }

  return scoredEventIds;
}

/**
 * Filter candidate events to only those within their sport's live window
 * and that have a valid live score payload.
 */
export function filterLiveEvents(
  candidates: LiveEvent[],
  nowMs: number,
): LiveEvent[] {
  return candidates.filter((e) => {
    const startMs = new Date(e.start_time).getTime();
    const windowMs =
      (getTimingForSport(e.sport).checkAfterHours + 1) * 3_600_000;
    if (nowMs >= startMs + windowMs) return false;

    const liveData = e.result_data?.live as LiveScore | undefined;
    return (
      typeof liveData?.homeScore === "number" &&
      typeof liveData?.awayScore === "number"
    );
  });
}

// ── Supabase-aware orchestrator ──────────────────────────────────────────────

/**
 * Apply provisional live-score points on top of confirmed baseline.
 *
 * Mutates `opts.pointsMap` in place by adding provisionally-computed points
 * from in-progress matches. Only called when the caller has decided live
 * overlay is desired.
 *
 * Used by both `/api/tournament/standings` and `/api/tournament/my-group`.
 */
export async function applyLiveOverlay(
  supabase: SupabaseClient,
  opts: LiveOverlayOptions,
): Promise<LiveOverlayResult> {
  const {
    userIds,
    pointsMap,
    tournamentId,
    competitionId,
    activeSportingStageId,
    isFormat,
  } = opts;

  if (userIds.length === 0) {
    return { hasLiveEvents: false, liveEventIds: [], livePredictions: [] };
  }

  const nowMs = Date.now();

  // Widest live window across sports is golf (8h + 1h buffer); 10h back
  // bounds the query, then filterLiveEvents applies per-sport windows.
  const tenHoursAgo = new Date(nowMs - 10 * 3_600_000);

  let liveQuery = supabase
    .from("events")
    .select(
      isFormat && activeSportingStageId
        ? "id, sport, start_time, result_data, rounds!inner(sporting_stage_id)"
        : "id, sport, start_time, result_data",
    )
    .eq("result_confirmed", false)
    .lte("start_time", new Date(nowMs).toISOString())
    .gte("start_time", tenHoursAgo.toISOString())
    .limit(100);

  if (isFormat && activeSportingStageId) {
    liveQuery = liveQuery.eq(
      "rounds.sporting_stage_id",
      activeSportingStageId,
    );
  }

  liveQuery = tournamentId
    ? liveQuery.eq("tournament_id", tournamentId)
    : liveQuery.eq("competition_id", competitionId);

  const { data: liveCandidates } = await liveQuery;

  const liveEvents = filterLiveEvents(
    (liveCandidates ?? []) as unknown as LiveEvent[],
    nowMs,
  );

  if (liveEvents.length === 0) {
    return { hasLiveEvents: false, liveEventIds: [], livePredictions: [] };
  }

  const liveEventIds = liveEvents.map((e) => e.id);

  // Session (anon) client: RLS only exposes other users' predictions
  // after pick_reveal_at — unrevealed picks are correctly excluded from
  // the provisional overlay.
  const predLimit = Math.min(userIds.length * liveEvents.length * 10, 50000);
  const [{ data: eptRows }, { data: livePreds }] = await Promise.all([
    supabase
      .from("event_prediction_types")
      .select("event_id, prediction_type, points, partial_points, config")
      .in("event_id", liveEventIds)
      .limit(2000),
    supabase
      .from("predictions")
      .select("user_id, event_id, prediction_type, prediction_data")
      .in("event_id", liveEventIds)
      .in("user_id", userIds)
      .limit(predLimit),
  ]);

  computeLivePoints(
    liveEvents,
    (eptRows ?? []) as LiveEpt[],
    (livePreds ?? []) as LivePrediction[],
    pointsMap,
  );

  return { hasLiveEvents: true, liveEventIds, livePredictions: (livePreds ?? []) as LivePrediction[] };
}
