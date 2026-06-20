import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchResult } from "./fetch-result";
import { searchEvents } from "./search-events";
import { getTimingForSport } from "./timing";
import { scorePrediction, buildScoreDerivedWinnerOverrides } from "@/lib/scoring";
import type { PredictionType, EventPredictionType } from "@/types/database";
import type { Sport } from "./types";
import { notifyResultConfirmed } from "@/lib/notifications/result-confirmed";

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

/** Stopwords for club football — excludes "united" to avoid breaking
 *  international team matching ("United States", "United Arab Emirates"). */
const STOPWORDS = new Set([
  "the",
  "fc",
  "afc",
  "utd",
  "city",
  "athletic",
  "county",
  "senior",
  "junior",
]);

/**
 * Country name aliases: maps alternate spellings/abbreviations to a
 * canonical form so Jaccard matching works across providers.
 * Keys MUST be lowercase.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "united states",
  "u.s.a.": "united states",
  "us": "united states",
  "czechia": "czech republic",
  "turkiye": "turkey",
  "türkiye": "turkey",
  "curacao": "curaçao",
  "curaçao": "curacao",
  "bosnia & herzegovina": "bosnia herzegovina",
  "bosnia and herzegovina": "bosnia herzegovina",
  "bosnia-herzegovina": "bosnia herzegovina",
  "dr congo": "congo dr",
  "congo dr": "dr congo",
  "ivory coast": "cote divoire",
  "cote d'ivoire": "ivory coast",
  "côte d'ivoire": "ivory coast",
  "korea republic": "south korea",
  "republic of korea": "south korea",
  "iran": "ir iran",
  "ir iran": "iran",
};

/** Strip diacritics (é→e, ü→u, ç→c etc.) for uniform tokenization. */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Apply country aliases to a lowercased string before tokenizing. */
function applyAliases(s: string): string {
  let result = s;
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    // Word-boundary–safe replacement (alias may contain spaces)
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    result = result.replace(pattern, canonical);
  }
  return result;
}

export function tokenOverlapScore(a: string, b: string): number {
  const normalize = (s: string): Set<string> => {
    let cleaned = stripDiacritics(s.toLowerCase());
    cleaned = cleaned
      .replace(/\bvs?\b|\bversus\b|\bat\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ");
    cleaned = applyAliases(cleaned);
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

    // Check for a previously resolved provider ID stored in result_data
    const storedProviderId = resultData.provider_event_id as string | undefined;

    if (storedProviderId) {
      resolvedExternalId = storedProviderId;
    } else if (
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
        { date: startDate, providerLeague: event.provider_league ?? undefined }
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
        // Single confident match — cache the provider ID in result_data
        // (don't overwrite external_event_id — it's the key used by WC2026_FIXTURES)
        resolvedExternalId = scored[0].candidate.external_event_id;
        await supabase
          .from("events")
          .update({ result_data: { ...resultData, provider_event_id: resolvedExternalId } })
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

    // Score predictions for the confirmed event
    await scoreEventPredictions(supabase, event.id, finalResultData, event.sport as string);

    // Notify all members (chat message + push) — fire-and-forget
    notifyResultConfirmed(
      event.id,
      event.competition_id,
      event.event_name,
      finalResultData,
    ).catch(() => {});

    // Propagate result to sibling events (same fixture across other
    // competition instances). One real-world match = one result,
    // regardless of how many instances were created from the blueprint.
    await propagateResultToSiblings(
      supabase,
      event.id,
      event.external_event_id,
      event.event_name,
      finalResultData,
      event.sport as string,
    );

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

/** Strip the `manual:` prefix to get the canonical fixture identifier. */
function normalizeExternalId(id: string | null): string | null {
  if (!id) return null;
  return id.startsWith("manual:") ? id.slice(7) : id;
}

/**
 * Score all predictions for a single event against confirmed result data.
 */
async function scoreEventPredictions(
  supabase: SupabaseClient,
  eventId: string,
  resultData: Record<string, unknown>,
  sport: string,
): Promise<void> {
  const { data: eptRows } = await supabase
    .from("event_prediction_types")
    .select("*")
    .eq("event_id", eventId);

  const eptMap = new Map<string, EventPredictionType>();
  for (const row of eptRows ?? []) {
    eptMap.set(row.prediction_type, row as EventPredictionType);
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("event_id", eventId);

  // Score is source of truth: derive winner from score when both exist
  const winnerEpt = eptMap.get("winner");
  const winnerOpts =
    ((winnerEpt?.config as Record<string, unknown> | null)?.options as
      | string[]
      | undefined) ?? [];
  const winnerOverrides = buildScoreDerivedWinnerOverrides(
    (predictions ?? []) as Array<{
      user_id: string;
      prediction_type: string;
      prediction_data: Record<string, unknown>;
    }>,
    winnerOpts,
    sport,
  );

  const scores: Array<{
    id: string;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
  }> = [];

  for (const prediction of predictions ?? []) {
    const predType = prediction.prediction_type as PredictionType;
    const ept = eptMap.get(predType);
    const eptData = ept ?? { points: 10, partial_points: 0, config: null };

    // For winner predictions, use score-derived value if available
    let predData = prediction.prediction_data as Record<string, unknown>;
    if (predType === "winner") {
      const override = winnerOverrides.get(prediction.user_id as string);
      if (override) predData = override;
    }

    const scoreResult = scorePrediction(predType, predData, resultData, eptData);

    scores.push({
      id: prediction.id as string,
      is_correct: scoreResult.is_correct,
      is_partial: scoreResult.is_partial,
      points_awarded: scoreResult.points_awarded,
    });
  }

  if (scores.length > 0) {
    await supabase.rpc("batch_score_predictions", { p_scores: scores });

    // Anomaly detection: if >80% of winner predictions scored as wrong on an
    // event with 15+ winner predictions, something is likely broken (provider
    // name mismatch, home/away swap, wrong result). Log a warning so it
    // surfaces in monitoring rather than silently corrupting the leaderboard.
    const winnerScores = scores.filter((s) => {
      const pred = (predictions ?? []).find((p) => (p as Record<string, unknown>).id === s.id);
      return (pred as Record<string, unknown> | undefined)?.prediction_type === "winner";
    });
    if (winnerScores.length >= 15) {
      const wrongCount = winnerScores.filter((s) => s.is_correct === false).length;
      const wrongPct = wrongCount / winnerScores.length;
      if (wrongPct > 0.8) {
        console.warn(
          `[scoring] ANOMALY: ${wrongCount}/${winnerScores.length} (${Math.round(wrongPct * 100)}%) ` +
          `winner predictions scored wrong for event ${eventId}. ` +
          `Possible provider name mismatch or incorrect result data.`
        );
      }
    }
  }
}

/**
 * Propagate a confirmed result to all sibling events across competition
 * instances that share the same fixture (normalized external_event_id).
 *
 * One real-world match produces one result. The blueprint/instance model
 * means multiple competition instances can reference the same fixture.
 * When the result is confirmed for any one instance, every other instance
 * gets the same result_data, scoring, and notifications.
 */
async function propagateResultToSiblings(
  supabase: SupabaseClient,
  confirmedEventId: string,
  externalEventId: string | null,
  eventName: string,
  resultData: Record<string, unknown>,
  sport: string,
): Promise<void> {
  const canonicalId = normalizeExternalId(externalEventId);
  if (!canonicalId) return;

  // Find all unconfirmed events that share this fixture.
  // Match both `manual:xyz` and bare `xyz` forms.
  const { data: siblings } = await supabase
    .from("events")
    .select("id, competition_id, external_event_id")
    .eq("result_confirmed", false)
    .neq("id", confirmedEventId)
    .or(`external_event_id.eq.${canonicalId},external_event_id.eq.manual:${canonicalId}`);

  if (!siblings || siblings.length === 0) return;

  for (const sibling of siblings) {
    // Confirm the sibling event
    const { data: updated } = await supabase
      .from("events")
      .update({
        result_data: resultData,
        result_confirmed: true,
        status: "resulted",
      })
      .eq("id", sibling.id)
      .eq("result_confirmed", false)
      .select("id")
      .maybeSingle();

    if (!updated) continue; // already confirmed by concurrent process

    // Score predictions for this instance
    await scoreEventPredictions(supabase, sibling.id, resultData, sport);

    // Notify this competition's members
    notifyResultConfirmed(
      sibling.id,
      sibling.competition_id,
      eventName,
      resultData,
    ).catch(() => {});

    console.log(
      `[auto-result] propagated result to sibling ${sibling.id} (competition ${sibling.competition_id})`,
    );
  }
}

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
