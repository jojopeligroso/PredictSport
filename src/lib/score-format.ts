import type { Sport } from "@/lib/sports/types";

export type ScoreFormat = "standard" | "gaa" | null;

/** Sports with standard numeric scores (home vs away) — used for result entry and score derivation */
const STANDARD_SCORE_SPORTS: Sport[] = [
  "soccer", "rugby", "rugby_league", "american_football", "basketball", "ice_hockey", "baseball",
  "snooker", "cricket",
];

const GAA_SPORTS: Sport[] = ["gaa", "gaelic_football", "hurling"];

/** Sports that cannot have exact_score predictions.
 *  Position-based sports have no score, cricket scores are too variable (multi-format, innings). */
const NO_EXACT_SCORE_SPORTS: Sport[] = [
  "formula_1", "golf", "horse_racing", "tennis", "athletics", "cricket",
];

export function getScoreFormat(sport: string): ScoreFormat {
  if (GAA_SPORTS.includes(sport as Sport)) return "gaa";
  if (STANDARD_SCORE_SPORTS.includes(sport as Sport)) return "standard";
  return null;
}

export function supportsExactScore(sport: string): boolean {
  return !NO_EXACT_SCORE_SPORTS.includes(sport as Sport);
}

/** Derive winner from a score prediction */
export function deriveWinnerFromScore(
  score: Record<string, unknown>,
  sport: string,
  options: string[]
): string | null {
  const format = getScoreFormat(sport);
  if (!format) return null;

  if (format === "gaa") {
    const home = score.home as Record<string, number> | undefined;
    const away = score.away as Record<string, number> | undefined;
    if (!home || !away) return null;

    const homeTotal = (home.goals ?? 0) * 3 + (home.points ?? 0);
    const awayTotal = (away.goals ?? 0) * 3 + (away.points ?? 0);

    if (homeTotal === awayTotal) return "Draw";
    return homeTotal > awayTotal ? (options[0] ?? null) : (options[1] ?? null);
  }

  // Standard format
  const homeScore = Number(score.home);
  const awayScore = Number(score.away);

  if (isNaN(homeScore) || isNaN(awayScore)) return null;
  if (homeScore === awayScore) return "Draw";
  return homeScore > awayScore ? (options[0] ?? null) : (options[1] ?? null);
}

/** Compute GAA aggregate from goals and points */
export function gaaAggregate(goals: number, points: number): number {
  return goals * 3 + points;
}
