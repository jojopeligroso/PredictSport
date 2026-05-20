import { supportsExactScore } from "@/lib/score-format";
import type { Sport } from "@/lib/sports/types";

/** Sports where a draw is a valid winner outcome */
export const DRAW_SPORTS = new Set<Sport>([
  "soccer",
  "rugby",
  "rugby_league",
  "gaa",
  "gaelic_football",
  "hurling",
  "cricket",
]);

/** Position-based / multi-competitor sports (no home/away) */
export const RACE_SPORTS = new Set<Sport>([
  "formula_1",
  "golf",
  "horse_racing",
  "athletics",
]);

export interface PersonalPredictionTypeRow {
  prediction_type: string;
  points: number;
  partial_points: number;
  config: Record<string, unknown> | null;
}

/**
 * Return the default event_prediction_type rows for a personal prediction event.
 *
 * Team sports (2 participants):
 *   - winner  (+ allow_draw for draw-eligible sports)
 *   - exact_score  (for sports that support it)
 *
 * Race / multi-competitor sports:
 *   - winner only (options = first 20 participants)
 *
 * Points are always 0 for personal predictions — scoring is not used.
 */
export function getPersonalDefaults(
  sport: Sport | string,
  participants: string[],
): PersonalPredictionTypeRow[] {
  const isRace = RACE_SPORTS.has(sport as Sport);
  const isTwoTeam = !isRace && participants.length === 2;

  if (isTwoTeam) {
    const allowDraw = DRAW_SPORTS.has(sport as Sport);
    const options = allowDraw
      ? [participants[0], "Draw", participants[1]]
      : [participants[0], participants[1]];

    const rows: PersonalPredictionTypeRow[] = [
      {
        prediction_type: "winner",
        points: 0,
        partial_points: 0,
        config: { options, allow_draw: allowDraw },
      },
    ];

    if (supportsExactScore(sport)) {
      rows.push({
        prediction_type: "exact_score",
        points: 0,
        partial_points: 0,
        config: { options: [participants[0], participants[1]] },
      });
    }

    return rows;
  }

  // Race / multi-competitor
  return [
    {
      prediction_type: "winner",
      points: 0,
      partial_points: 0,
      config: { options: participants.slice(0, 20) },
    },
  ];
}
