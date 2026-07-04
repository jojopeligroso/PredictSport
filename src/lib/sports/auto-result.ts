import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchResult, verifyResult, enrichAETFullTimeScore, type VerificationStatus } from "./fetch-result";
import { searchEvents } from "./search-events";
import { getTimingForSport } from "./timing";
import { scorePrediction, buildScoreDerivedWinnerOverrides } from "@/lib/scoring";
import type { PredictionType, EventPredictionType } from "@/types/database";
import type { Sport } from "./types";
import { notifyResultConfirmed } from "@/lib/notifications/result-confirmed";
import { notifyResultDisputed } from "@/lib/notifications/result-disputed";
import { processEventTags, checkRoundCompletionAndProcessTags } from "@/lib/reputation";
import { TEAM_ALIASES, applyTeamAliases } from "@/lib/sports/team-aliases";
import { advanceKnockoutWinners } from "@/lib/tournament/bracket/advance";

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

// Team name aliases imported from @/lib/sports/team-aliases (TEAM_ALIASES, applyTeamAliases)

/**
 * Groups of interchangeable team name variants. When a provider text
 * search fails (e.g. TheSportsDB's searchevents.php), we retry with
 * each alternate form from the matching group.
 */
const TEAM_NAME_GROUPS: string[][] = [
  ["DR Congo", "Congo DR"],
  ["Bosnia-Herzegovina", "Bosnia and Herzegovina", "Bosnia & Herzegovina"],
  ["Ivory Coast", "Cote d'Ivoire"],
  ["Czechia", "Czech Republic"],
  ["Turkiye", "Turkey"],
  ["USA", "United States"],
  ["South Korea", "Korea Republic"],
  ["Iran", "IR Iran"],
];

/**
 * Generate alternate event names by swapping known team name variants.
 * E.g. "England vs Congo DR" → ["England vs DR Congo"]
 */
export function generateSearchVariants(eventName: string): string[] {
  const lower = eventName.toLowerCase();
  const variants = new Set<string>();

  for (const group of TEAM_NAME_GROUPS) {
    for (const member of group) {
      if (lower.includes(member.toLowerCase())) {
        for (const alt of group) {
          if (alt.toLowerCase() !== member.toLowerCase()) {
            const regex = new RegExp(
              member.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i"
            );
            const variant = eventName.replace(regex, alt);
            if (variant !== eventName) variants.add(variant);
          }
        }
        break; // found match in this group, check next group
      }
    }
  }

  return Array.from(variants);
}

/** Strip diacritics (é→e, ü→u, ç→c etc.) for uniform tokenization. */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function tokenOverlapScore(a: string, b: string): number {
  const normalize = (s: string): Set<string> => {
    let cleaned = stripDiacritics(s.toLowerCase());
    cleaned = cleaned
      .replace(/\bvs?\b|\bversus\b|\bat\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ");
    cleaned = applyTeamAliases(cleaned);
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

    // 1. Already confirmed — skip unless verification is still pending
    if (resultData.auto_result_status === "confirmed") {
      const vStatus = resultData.verification_status as VerificationStatus | undefined;
      if (vStatus && vStatus !== "pending") {
        return { ...base, status: "skipped", message: "already auto-confirmed and verified" };
      }
      if (vStatus === "pending") {
        // Re-enter to retry verification (step 9 below)
        return await retryVerification(supabase, event, resultData, base);
      }
      // No verification_status yet — first run was before cross-validation existed
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
      const eventStartMs = new Date(event.start_time).getTime();
      const oneDayMs = 24 * 3600000;

      // Search and score helper — Jaccard always scored against the
      // original event name so country aliases normalise both sides.
      const searchAndScore = async (searchName: string) => {
        const candidates = await searchEvents(
          event.sport as Sport,
          searchName,
          { date: startDate, providerLeague: event.provider_league ?? undefined }
        );
        return candidates
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
      };

      let scored = await searchAndScore(event.event_name);

      // If no confident match, retry with alternate team name variants.
      // Providers use inconsistent naming (e.g. TheSportsDB "DR Congo"
      // vs our "Congo DR") and their text-search APIs need the right form.
      if (scored.length === 0) {
        const variants = generateSearchVariants(event.event_name);
        for (const variant of variants) {
          scored = await searchAndScore(variant);
          if (scored.length > 0) {
            console.log(
              `[results-cron] variant search hit: "${event.event_name}" → "${variant}" found ${scored.length} candidate(s)`,
            );
            break;
          }
        }
      }

      if (scored.length === 1 && scored[0].candidate.external_event_id && scored[0].candidate.external_event_id !== "undefined") {
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

    // 7b. Knockout guard: if the provider reports a draw but the event
    //     has a H2H "who goes through?" prediction (allow_draw: false),
    //     the match must continue to ET/penalties. Don't confirm until
    //     the provider returns a non-draw winner (status AP or AET).
    const isDrawResult =
      result.winner === "draw" ||
      (result.score &&
        result.score.home_score === result.score.away_score &&
        (!result.winner || result.winner === "draw"));

    if (isDrawResult) {
      const { data: knockoutEpt } = await supabase
        .from("event_prediction_types")
        .select("id")
        .eq("event_id", event.id)
        .eq("prediction_type", "head_to_head")
        .limit(1);

      if (knockoutEpt && knockoutEpt.length > 0) {
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
          message: "knockout match drawn at FT — waiting for ET/penalties result",
        };
      }
    }

    // 8. Enrich AET results with FT score from API-Football (if primary
    //    provider didn't include it). This allows exact_score to be scored
    //    against the 90-minute score rather than the AET aggregate.
    const finalResultData: Record<string, unknown> = {
      ...resultToPlainObject(result),
      auto_result_status: "confirmed",
    };
    const score = finalResultData.score as Record<string, unknown> | undefined;
    const periods = score?.periods as Record<string, Record<string, number>> | undefined;
    if ((periods?.extra_time || periods?.penalties) && !periods?.full_time) {
      const enriched = await enrichAETFullTimeScore(finalResultData, event.event_name, event.start_time);

      // Fallback: if API-Football enrichment failed, use the live-cron's
      // ftScore snapshot (captured during regulation before ET started).
      // Accept only if the snapshot is a draw (ET only follows a draw).
      if (!enriched && resultData?.live) {
        const liveData = resultData.live as { ftScore?: { home: number; away: number } } | undefined;
        if (
          liveData?.ftScore &&
          typeof liveData.ftScore.home === "number" &&
          typeof liveData.ftScore.away === "number" &&
          liveData.ftScore.home === liveData.ftScore.away
        ) {
          const enrichedPeriods = (finalResultData.score as Record<string, unknown>).periods as Record<string, Record<string, number>>;
          enrichedPeriods.full_time = liveData.ftScore as unknown as Record<string, number>;
          console.log(
            `[auto-result] Enriched "${event.event_name}" FT from live snapshot: ${liveData.ftScore.home}-${liveData.ftScore.away}`,
          );
        }
      }
    }

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

    // Broadcast scoring update so leaderboard clients can refetch
    await supabase.channel("scoring_events").send({
      type: "broadcast",
      event: "scores_updated",
      payload: { competition_id: event.competition_id, event_id: event.id },
    }).catch(() => {});

    // Notify all members (chat message + push) — fire-and-forget
    notifyResultConfirmed(
      event.id,
      event.competition_id,
      event.event_name,
      finalResultData,
    ).catch(() => {});

    // Process reputation tags (fire-and-forget)
    processEventTags(event.competition_id, event.id).catch(() => {});
    checkRoundCompletionAndProcessTags(event.competition_id, event.id).catch(() => {});

    // Advance knockout bracket: propagate winner into downstream fixtures
    if (event.external_event_id?.match(/^manual:wc2026-(r32|r16|qf|sf|3rd|final)-/)) {
      advanceKnockoutWinners(supabase, {
        event_name: event.event_name,
        external_event_id: event.external_event_id,
        result_data: finalResultData,
      }).catch((err) => {
        console.error("[auto-resolve] Bracket advancement failed:", err);
      });
    }

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

    // 9. Async cross-validation (ADR 0019)
    // Fire-and-forget: verify against a second provider. Result is stored
    // in result_data but does not block scoring or user notifications.
    triggerVerification(
      supabase,
      event,
      { score: result.score, positions: result.positions, provider: result.provider },
      finalResultData,
    ).catch((err) => {
      console.error(`[auto-result] verification failed for ${event.event_name}:`, err);
    });

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
// Cross-validation helpers (ADR 0019)
// ---------------------------------------------------------------------------

/**
 * Run cross-validation for a freshly confirmed result.
 * Sets verification_status to pending, then attempts immediate verification.
 */
async function triggerVerification(
  supabase: SupabaseClient,
  event: AutoResultEvent,
  primaryInput: { score: import("./types").ResultScore | null; positions: import("./types").ResultPosition[] | null; provider: string },
  currentResultData: Record<string, unknown>,
): Promise<void> {
  // Mark as pending verification
  const withPending = {
    ...currentResultData,
    verification_status: "pending" as VerificationStatus,
    verification_attempts: 0,
    verified_at: null,
    verification_provider: null,
  };
  await supabase
    .from("events")
    .update({ result_data: withPending })
    .eq("id", event.id);

  // Resolve the external ID for verification
  const resolvedId =
    (currentResultData.provider_event_id as string | undefined) ??
    (event.external_event_id?.startsWith("manual:")
      ? null
      : event.external_event_id);

  if (!resolvedId) {
    // No external ID — can't verify
    await supabase
      .from("events")
      .update({
        result_data: {
          ...withPending,
          verification_status: "unverifiable" as VerificationStatus,
          verification_attempts: 1,
          verified_at: new Date().toISOString(),
        },
      })
      .eq("id", event.id);
    return;
  }

  const vResult = await verifyResult(
    primaryInput,
    event.sport as Sport,
    resolvedId,
    event.provider_league ?? undefined,
  );

  const updatedData: Record<string, unknown> = {
    ...withPending,
    verification_status: vResult.status,
    verification_provider: vResult.verifierProvider,
    verification_attempts: 1,
  };

  if (vResult.status === "verified" || vResult.status === "unverifiable") {
    updatedData.verified_at = new Date().toISOString();
  }

  await supabase
    .from("events")
    .update({ result_data: updatedData })
    .eq("id", event.id);

  // Handle dispute notification
  if (vResult.status === "disputed" && vResult.verifierScore) {
    notifyResultDisputed(
      event.id,
      event.competition_id,
      event.event_name,
      vResult.primaryScore,
      vResult.verifierScore,
      primaryInput.provider,
      vResult.verifierProvider!,
    ).catch(() => {});
  }

  // Handle pending (verifier not final) — admin gets a heads-up
  if (vResult.status === "pending" && vResult.verifierProvider) {
    console.log(
      `[auto-result] verification pending for ${event.event_name}: ` +
      `verifier ${vResult.verifierProvider} not final yet, will retry next cycle`,
    );
  }
}

/**
 * Retry verification for an already-confirmed event on the next cron cycle.
 * Called when the event re-enters autoResolveEvent with verification_status: "pending".
 */
async function retryVerification(
  supabase: SupabaseClient,
  event: AutoResultEvent,
  resultData: Record<string, unknown>,
  base: { event_id: string; event_name: string },
): Promise<AutoResultOutcome> {
  const attempts = (resultData.verification_attempts as number) ?? 0;

  // Budget exhausted: 2 total attempts max (1 immediate + 1 retry)
  if (attempts >= 2) {
    const updated = {
      ...resultData,
      verification_status: "unverifiable" as VerificationStatus,
      verified_at: new Date().toISOString(),
    };
    await supabase
      .from("events")
      .update({ result_data: updated })
      .eq("id", event.id);
    console.log(
      `[auto-result] verification budget exhausted for ${event.event_name}, promoting to unverifiable`,
    );
    return { ...base, status: "skipped", message: "verification promoted to unverifiable" };
  }

  // Resolve external ID
  const resolvedId =
    (resultData.provider_event_id as string | undefined) ??
    (event.external_event_id?.startsWith("manual:")
      ? null
      : event.external_event_id);

  if (!resolvedId) {
    const updated = {
      ...resultData,
      verification_status: "unverifiable" as VerificationStatus,
      verification_attempts: attempts + 1,
      verified_at: new Date().toISOString(),
    };
    await supabase
      .from("events")
      .update({ result_data: updated })
      .eq("id", event.id);
    return { ...base, status: "skipped", message: "no external ID for verification" };
  }

  const primaryProvider = resultData.provider as string;
  const primaryInput = {
    score: resultData.score as import("./types").ResultScore | null ?? null,
    positions: resultData.positions as import("./types").ResultPosition[] | null ?? null,
    provider: primaryProvider,
  };

  const vResult = await verifyResult(
    primaryInput,
    event.sport as Sport,
    resolvedId,
    event.provider_league ?? undefined,
  );

  const updatedData: Record<string, unknown> = {
    ...resultData,
    verification_status: vResult.status,
    verification_provider: vResult.verifierProvider,
    verification_attempts: attempts + 1,
  };

  if (vResult.status === "verified" || vResult.status === "unverifiable") {
    updatedData.verified_at = new Date().toISOString();
  }

  await supabase
    .from("events")
    .update({ result_data: updatedData })
    .eq("id", event.id);

  if (vResult.status === "disputed" && vResult.verifierScore) {
    notifyResultDisputed(
      event.id,
      event.competition_id,
      event.event_name,
      vResult.primaryScore,
      vResult.verifierScore,
      primaryProvider,
      vResult.verifierProvider!,
    ).catch(() => {});
  }

  return { ...base, status: "skipped", message: `verification retry: ${vResult.status}` };
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

    // Consistency check: if any user's exact_score is correct but their
    // winner prediction is wrong, the scoring engine has a bug. This state
    // is impossible in correct operation — a correct score always implies
    // the correct winner (since winner is derived from score). Upsets
    // cannot trigger this; only scoring logic errors can.
    const preds = (predictions ?? []) as Array<Record<string, unknown>>;
    const scoreCorrectUsers = new Set<string>();
    const winnerWrongUsers = new Set<string>();

    for (const s of scores) {
      const pred = preds.find((p) => p.id === s.id);
      if (!pred) continue;
      if (pred.prediction_type === "exact_score" && s.is_correct === true) {
        scoreCorrectUsers.add(pred.user_id as string);
      }
      if (pred.prediction_type === "winner" && s.is_correct === false) {
        winnerWrongUsers.add(pred.user_id as string);
      }
    }

    const contradictions = [...scoreCorrectUsers].filter((u) => winnerWrongUsers.has(u));
    if (contradictions.length > 0) {
      console.error(
        `[scoring] CONTRADICTION: ${contradictions.length} user(s) have exact_score=correct ` +
        `but winner=wrong for event ${eventId}. This is an impossible state — ` +
        `indicates a scoring engine bug (name mismatch, home/away swap, etc).`
      );
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

    // Broadcast scoring update for sibling instance
    await supabase.channel("scoring_events").send({
      type: "broadcast",
      event: "scores_updated",
      payload: { competition_id: sibling.competition_id, event_id: sibling.id },
    }).catch(() => {});

    // Notify this competition's members
    notifyResultConfirmed(
      sibling.id,
      sibling.competition_id,
      eventName,
      resultData,
    ).catch(() => {});

    // Process reputation tags for sibling instance
    processEventTags(sibling.competition_id, sibling.id).catch(() => {});
    checkRoundCompletionAndProcessTags(sibling.competition_id, sibling.id).catch(() => {});

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
