/**
 * Elimination Curve Generator
 *
 * Generates a strictly decreasing elimination curve for tournament competitions.
 * Given an entrant count (8-96), returns the number of survivors at each stage.
 *
 * Algorithm: group stage reduces by ~1/3, then generous halving with minimum
 * thresholds to ensure >= 1 elimination at every stage. Final prediction window
 * band is determined by entrant count tier.
 */

export interface CurveStep {
  stage: string;
  remaining: number;
}

/**
 * Determines the number of finalists for the final prediction window.
 * 8-55 → 2, 56-79 → 3, 80-96 → 4.
 */
function getFinalBand(entrantCount: number): number {
  if (entrantCount <= 55) return 2;
  if (entrantCount <= 79) return 3;
  return 4;
}

/**
 * Generates an elimination curve for a tournament with the given entrant count.
 *
 * @param entrantCount Number of entrants (8-96)
 * @returns Ordered array of { stage, remaining } from start to winner
 * @throws If entrantCount is outside 8-96 range
 */
export function generateEliminationCurve(entrantCount: number): CurveStep[] {
  if (entrantCount < 8 || entrantCount > 96) {
    throw new Error(`Entrant count must be 8-96, got ${entrantCount}`);
  }

  // Group stage: reduce by ~1/3
  const gsTarget = Math.ceil((entrantCount * 2) / 3);

  // Final prediction window band
  const fpw = getFinalBand(entrantCount);

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
