import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchResult } from "./fetch-result";
import { searchEvents } from "./search-events";
import { getTimingForSport } from "./timing";
import { scorePrediction } from "@/lib/scoring";
import type { PredictionType, EventPredictionType } from "@/types/database";
import type { Sport } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoResultEvent {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  external_event_id: string | null;
  provider_league: string | null;
  result_data: Record<string, unknown> | null;
  competition_id: string;
}

export type AutoResultStatus =
  | "confirmed"
  | "no_result"
  | "window_expired"
  | "skipped"
  | "error";

export interface AutoResultOutcome {
  event_id: string;
  event_name: string;
  status: AutoResultStatus;
  provider?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Token overlap scoring (Jaccard similarity)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the",
  "fc",
  "afc",
  "utd",
  "united",
  "city",
  "athletic",
  "county",
  "senior",
  "junior",
]);

export function tokenOverlapScore(a: string, b: string): number {
  const normalize = (s: string): Set<string> => {
    const cleaned = s
      .toLowerCase()
      .replace(/\bvs?\b|\bversus\b/g, " ")
      .replace(/[^a-z0-9\s]/g, "");
    const tokens = cleaned
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t));
    return new Set(tokens);
  };

  const setA = normalize(a);
  const setB = normalize(b);

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Main auto-resolve function
// ---------------------------------------------------------------------------

export async function autoResolveEvent(
  supabase: SupabaseClient,
  event: AutoResultEvent,
  now: Date
): Promise<AutoResultOutcome> {
  const base = { event_id: event.id, event_name: event.event_name };

  try {
    const resultData = event.result_data ?? {};

    // 1. Already confirmed via auto-result
    if (resultData.auto_result_status === "confirmed") {
      return { ...base, status: "skipped", message: "already auto-confirmed" };
    }

    // 2. Compute timing
    const timing = getTimingForSport(event.sport);
    const startTime = new Date(event.start_time).getTime();
    const windowExpiry = startTime + timing.windowHours * 3600000;

    const checkAfterRaw = resultData.auto_result_check_after as
      | string
      | undefined;
    const checkAfter = checkAfterRaw
      ? new Date(checkAfterRaw).getTime()
      : startTime + timing.checkAfterHours * 3600000;

    const nowMs = now.getTime();

    // 3. Window expired
    if (nowMs > windowExpiry) {
      const updatedResultData = {
        ...resultData,
        auto_result_status: "window_expired",
      };
      await supabase
        .from("events")
        .update({ result_data: updatedResultData })
        .eq("id", event.id);

      return { ...base, status: "window_expired" };
    }

    // 4. Too early to check
    if (nowMs < checkAfter) {
      return { ...base, status: "skipped", message: "too early" };
    }

    // 5. Resolve external_event_id
    let resolvedExternalId: string | null = null;

    if (
      event.external_event_id &&
      !event.external_event_id.startsWith("manual:")
    ) {
      // Has a real provider-assigned external ID
      resolvedExternalId = event.external_event_id;
    } else {
      // Need to search for a match
      const startDate = event.start_time.slice(0, 10); // YYYY-MM-DD
      const candidates = await searchEvents(
        event.sport as Sport,
        event.event_name,
        { date: startDate }
      );

      // Score and filter candidates
      const eventStartMs = new Date(event.start_time).getTime();
      const oneDayMs = 24 * 3600000;

      const scored = candidates
        .map((c) => ({
          candidate: c,
          score: tokenOverlapScore(event.event_name, c.event_name),
        }))
        .filter((c) => {
          if (c.score < 0.6) return false;
          const candidateMs = new Date(c.candidate.start_time).getTime();
          return Math.abs(candidateMs - eventStartMs) <= oneDayMs;
        })
        .sort((a, b) => b.score - a.score);

      if (scored.length === 1) {
        // Single confident match — save the external_event_id
        resolvedExternalId = scored[0].candidate.external_event_id;
        await supabase
          .from("events")
          .update({ external_event_id: resolvedExternalId })
          .eq("id", event.id);
      } else if (scored.length === 0) {
        return {
          ...base,
          status: "no_result",
          message: "no matching external event found",
        };
      } else {
        return {
          ...base,
          status: "no_result",
          message: `ambiguous: ${scored.length} candidates matched (scores: ${scored.map((s) => s.score.toFixed(2)).join(", ")})`,
        };
      }
    }

    // 6. Fetch result from provider chain
    const result = await fetchResult(
      event.sport as Sport,
      resolvedExternalId!,
      event.provider_league ?? undefined
    );

    if (!result) {
      return {
        ...base,
        status: "no_result",
        message: "provider returned no result",
      };
    }

    // 7. Check is_final
    if (!result.is_final) {
      // Save provisional data for visibility but don't confirm
      const provisionalData = {
        ...resultData,
        ...resultToPlainObject(result),
        auto_result_status: "provisional",
      };
      await supabase
        .from("events")
        .update({ result_data: provisionalData })
        .eq("id", event.id);

      return {
        ...base,
        status: "no_result",
        provider: result.provider,
        message: "not final yet",
      };
    }

    // 8. Confirm and score (is_final = true)
    const finalResultData = {
      ...resultToPlainObject(result),
      auto_result_status: "confirmed",
    };

    const { data: confirmedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        result_data: finalResultData,
        result_confirmed: true,
        status: "resulted",
      })
      .eq("id", event.id)
      .eq("result_confirmed", false)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return {
        ...base,
        status: "error",
        message: `update failed: ${updateError.message}`,
      };
    }

    if (!confirmedEvent) {
      // Already confirmed by concurrent process
      return {
        ...base,
        status: "skipped",
        message: "already confirmed by concurrent process",
      };
    }

    // Fetch event_prediction_types
    const { data: eptRows } = await supabase
      .from("event_prediction_types")
      .select("*")
      .eq("event_id", event.id);

    const eptMap = new Map<string, EventPredictionType>();
    for (const row of eptRows ?? []) {
      eptMap.set(row.prediction_type, row as EventPredictionType);
    }

    // Fetch all predictions
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .eq("event_id", event.id);

    // Score each prediction
    for (const prediction of predictions ?? []) {
      const predType = prediction.prediction_type as PredictionType;
      const ept = eptMap.get(predType);

      const eptData = ept ?? {
        points: 10,
        partial_points: 0,
        config: null,
      };

      const scoreResult = scorePrediction(
        predType,
        prediction.prediction_data as Record<string, unknown>,
        finalResultData as Record<string, unknown>,
        eptData
      );

      await supabase
        .from("predictions")
        .update({
          is_correct: scoreResult.is_correct,
          is_partial: scoreResult.is_partial,
          points_awarded: scoreResult.points_awarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prediction.id);
    }

    return {
      ...base,
      status: "confirmed",
      provider: result.provider,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[auto-result] Error for ${event.event_name}:`, err);
    return { ...base, status: "error", message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a NormalizedResult to a plain JSON object suitable for result_data,
 * stripping the raw field to keep storage lean.
 */
function resultToPlainObject(
  result: NonNullable<Awaited<ReturnType<typeof fetchResult>>>
): Record<string, unknown> {
  return {
    provider: result.provider,
    fetched_at: result.fetched_at,
    sport: result.sport,
    external_event_id: result.external_event_id,
    event_name: result.event_name,
    is_final: result.is_final,
    positions: result.positions,
    score: result.score,
    winner: result.winner,
    margin: result.margin,
    stats: result.stats,
  };
}
