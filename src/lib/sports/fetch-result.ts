import type { NormalizedResult, ResultScore, ResultPosition, Sport } from "./types";
import { getProvidersForSport } from "./registry";
import { searchEvents } from "./search-events";

/**
 * Fetch the result for a sporting event by trying providers in priority order.
 * Returns null if all providers fail or return nothing (manual entry needed).
 *
 * @param providerLeague - Optional league path stored at pick time (e.g. "cricket/8044").
 *   Passed through to providers that support multi-league routing (ESPN).
 *   Providers that don't use it simply ignore the parameter.
 */
export async function fetchResult(
  sport: Sport,
  externalEventId: string,
  providerLeague?: string
): Promise<NormalizedResult | null> {
  const providers = getProvidersForSport(sport);

  for (const provider of providers) {
    try {
      const result = await provider.getResult(sport, externalEventId, providerLeague);
      if (result) return result;
    } catch (error) {
      console.error(
        `[sports] ${provider.name} failed for ${sport}/${externalEventId}:`,
        error
      );
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cross-validation (ADR 0019)
// ---------------------------------------------------------------------------

export type CompareVerdict = "match" | "mismatch" | "inconclusive";

export interface CompareInput {
  score?: ResultScore | null;
  positions?: ResultPosition[] | null;
}

/**
 * Pure comparison of two provider results.
 *
 * - Team sports: compares home_score and away_score only (never team name
 *   strings — that would reintroduce the name-mismatch bug).
 * - Position sports: compares top 3 finishing names (lowercased, trimmed).
 * - Returns "inconclusive" when neither result has the fields needed to compare.
 */
export function compareResults(
  primary: CompareInput,
  verifier: CompareInput,
): CompareVerdict {
  // Try score-based comparison first (team sports)
  if (hasScore(primary.score) && hasScore(verifier.score)) {
    const ps = primary.score!;
    const vs = verifier.score!;
    return ps.home_score === vs.home_score && ps.away_score === vs.away_score
      ? "match"
      : "mismatch";
  }

  // Try position-based comparison (F1, golf, horse racing)
  if (hasPositions(primary.positions) && hasPositions(verifier.positions)) {
    const top3Primary = primary.positions!.slice(0, 3);
    const top3Verifier = verifier.positions!.slice(0, 3);

    // Both must have at least 1 position to compare
    if (top3Primary.length === 0 || top3Verifier.length === 0) {
      return "inconclusive";
    }

    // Compare the shorter of the two lists (if one has 2 and other has 3,
    // compare 2 positions)
    const compareLen = Math.min(top3Primary.length, top3Verifier.length);
    for (let i = 0; i < compareLen; i++) {
      if (normalizeName(top3Primary[i].name) !== normalizeName(top3Verifier[i].name)) {
        return "mismatch";
      }
    }
    return "match";
  }

  return "inconclusive";
}

function hasScore(score: ResultScore | null | undefined): score is ResultScore {
  return (
    score != null &&
    typeof score.home_score === "number" &&
    typeof score.away_score === "number"
  );
}

function hasPositions(
  positions: ResultPosition[] | null | undefined,
): positions is ResultPosition[] {
  return Array.isArray(positions) && positions.length > 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Verification orchestration
// ---------------------------------------------------------------------------

export type VerificationStatus =
  | "verified"
  | "disputed"
  | "unverifiable"
  | "pending";

export interface VerificationResult {
  status: VerificationStatus;
  verifierProvider: string | null;
  primaryScore: CompareInput;
  verifierScore: CompareInput | null;
  verifierIsFinal: boolean | null;
}

/**
 * Verify a primary result by fetching from the next provider in the chain.
 *
 * Walks the provider registry for the sport, skipping the provider that
 * returned the primary result, and compares via compareResults().
 *
 * Returns:
 * - "verified" if scores match (regardless of verifier is_final)
 * - "disputed" if scores differ and verifier is_final
 * - "pending" if scores differ and verifier is not final (retry later)
 * - "unverifiable" if no alternative provider returns a result
 */
export async function verifyResult(
  primaryResult: CompareInput & { provider: string },
  sport: Sport,
  externalEventId: string,
  providerLeague?: string,
): Promise<VerificationResult> {
  const providers = getProvidersForSport(sport);

  for (const provider of providers) {
    // Skip the primary provider and non-result providers (fixturePool, manual)
    if (
      provider.name === primaryResult.provider ||
      provider.name === "fixture-pool" ||
      provider.name === "manual"
    ) {
      continue;
    }

    try {
      const verifierResult = await provider.getResult(
        sport,
        externalEventId,
        providerLeague,
      );
      if (!verifierResult) continue;

      const verdict = compareResults(primaryResult, verifierResult);

      if (verdict === "match") {
        return {
          status: "verified",
          verifierProvider: provider.name,
          primaryScore: primaryResult,
          verifierScore: verifierResult,
          verifierIsFinal: verifierResult.is_final,
        };
      }

      if (verdict === "mismatch") {
        return {
          status: verifierResult.is_final ? "disputed" : "pending",
          verifierProvider: provider.name,
          primaryScore: primaryResult,
          verifierScore: verifierResult,
          verifierIsFinal: verifierResult.is_final,
        };
      }

      // inconclusive — try next provider
    } catch (error) {
      console.error(
        `[verify] ${provider.name} failed for ${sport}/${externalEventId}:`,
        error,
      );
    }
  }

  // No provider could verify
  return {
    status: "unverifiable",
    verifierProvider: null,
    primaryScore: primaryResult,
    verifierScore: null,
    verifierIsFinal: null,
  };
}

// ---------------------------------------------------------------------------
// AET full-time score enrichment
// ---------------------------------------------------------------------------

/**
 * When a result has extra_time or penalties in periods but no full_time
 * breakdown, attempt a secondary fetch from API-Football (which provides
 * score.fulltime) to enrich the result with the FT score. This allows
 * exact_score to be scored against the 90-minute score rather than the
 * AET aggregate.
 *
 * Penalties imply ET was played (in knockouts pens only follow ET), so
 * even when the primary provider reports only `penalties` without
 * `extra_time`, the stored aggregate may include ET goals and needs FT
 * enrichment.
 *
 * Mutates resultData in place if FT score is found.
 */
export async function enrichAETFullTimeScore(
  resultData: Record<string, unknown>,
  eventName: string,
  startTime: string,
): Promise<boolean> {
  const score = resultData.score as Record<string, unknown> | undefined;
  if (!score) return false;

  const periods = score.periods as Record<string, Record<string, number>> | undefined;
  // ET or pens both indicate the match went beyond 90 minutes.
  if (!periods?.extra_time && !periods?.penalties) return false;
  if (periods.full_time) return false; // Already has FT score

  // Search API-Football by team name and date
  const startDate = startTime.slice(0, 10);
  const providers = getProvidersForSport("soccer");
  const apiFootball = providers.find((p) => p.name === "api-football");
  if (!apiFootball) return false;

  try {
    // Extract one team name from "TeamA vs TeamB" for search
    const teamName = eventName.split(/\s+vs?\s+/i)[0]?.trim();
    if (!teamName) return false;

    const candidates = await apiFootball.searchEvents("soccer", teamName, {
      date: startDate,
      limit: 5,
    });

    // Find a match with overlapping team names
    const eventNameLower = eventName.toLowerCase();
    const match = candidates.find((c) => {
      const parts = c.event_name.toLowerCase().split(/\s+vs?\s+/);
      return parts.some((p) => eventNameLower.includes(p.trim()));
    });

    if (!match) return false;

    // Fetch the full result from API-Football
    const afResult = await apiFootball.getResult("soccer", match.external_event_id);
    if (!afResult?.score?.periods) return false;

    const afPeriods = afResult.score.periods as Record<string, { home: number; away: number }>;
    if (!afPeriods.full_time) return false;

    // Verify the FT score is a draw (sanity check — ET only happens after a draw)
    if (afPeriods.full_time.home !== afPeriods.full_time.away) {
      console.warn(
        `[enrich-aet] API-Football FT score is not a draw for "${eventName}": ${afPeriods.full_time.home}-${afPeriods.full_time.away}`,
      );
      return false;
    }

    // Enrich the periods with FT score
    periods.full_time = afPeriods.full_time;
    console.log(
      `[enrich-aet] Enriched "${eventName}" with FT score: ${afPeriods.full_time.home}-${afPeriods.full_time.away}`,
    );
    return true;
  } catch (err) {
    console.error(`[enrich-aet] Failed for "${eventName}":`, err);
    return false;
  }
}
