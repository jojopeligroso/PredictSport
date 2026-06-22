/**
 * Elimination Curve Generator
 *
 * Generates a strictly decreasing elimination curve for tournament competitions.
 * Given an entrant count (8-48), returns the number of survivors at each stage.
 *
 * Algorithm: group stage reduces by ~1/3, then generous halving with minimum
 * thresholds to ensure >= 1 elimination at every stage. Every instance caps at
 * 48 entrants (auto-provision spins up a fresh instance when one fills), so the
 * final prediction window always seats 2 finalists.
 */

export interface CurveStep {
  stage: string;
  remaining: number;
}

/** Hard ceiling on entrants per instance. Mirrors the membership cap. */
export const MAX_ENTRANTS_PER_INSTANCE = 48;

/**
 * Generates an elimination curve for a tournament with the given entrant count.
 *
 * @param entrantCount Number of entrants (8-48)
 * @returns Ordered array of { stage, remaining } from start to winner
 * @throws If entrantCount is outside 8-48 range
 */
export function generateEliminationCurve(entrantCount: number): CurveStep[] {
  if (entrantCount < 8 || entrantCount > MAX_ENTRANTS_PER_INSTANCE) {
    throw new Error(
      `Entrant count must be 8-${MAX_ENTRANTS_PER_INSTANCE}, got ${entrantCount}`
    );
  }

  // Group stage: reduce by ~1/3
  const gsTarget = Math.ceil((entrantCount * 2) / 3);

  // Final prediction window seats 2 finalists at every valid (8-48) size.
  const fpw = 2;

  // Minimum values to guarantee >= 1 elimination at every step
  const minQF = fpw + 1;
  const minR16 = fpw + 2;
  const minR32 = fpw + 3;

  // Forward pass: generous halving clamped to minimums
  const r32 = Math.max(Math.ceil(gsTarget / 2), minR32);
  const r16 = Math.max(Math.ceil(r32 / 2), minR16);
  const qf = Math.max(Math.ceil(r16 / 2), minQF);

  // SF always reduces to band count
  const sf = fpw;

  return [
    { stage: "start", remaining: entrantCount },
    { stage: "group_stage", remaining: gsTarget },
    { stage: "round_of_32", remaining: r32 },
    { stage: "round_of_16", remaining: r16 },
    { stage: "quarter_finals", remaining: qf },
    { stage: "semi_finals", remaining: sf },
    { stage: "final", remaining: 1 },
  ];
}
