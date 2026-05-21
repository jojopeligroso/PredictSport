/**
 * Centralized draw-eligibility logic.
 *
 * Most sports are straightforward (soccer: yes, tennis: no). Cricket is
 * format-dependent: Test/first-class can draw, T20/ODI cannot. The
 * provider_league stored on the event tells us which format it is.
 */

import { cricketAllowsDraws } from "@/lib/sports/cricket-leagues";

/** Sports where draws are always valid (regardless of league) */
const ALWAYS_DRAW_SPORTS = new Set([
  "soccer",
  "rugby",
  "rugby_league",
  "gaa",
  "gaelic_football",
  "hurling",
  "hockey",
  "ice_hockey",
]);

/**
 * Whether a match in this sport/league allows a draw outcome.
 *
 * @param sport - e.g. "soccer", "cricket"
 * @param providerLeague - e.g. "cricket/8052" (County Championship). Only
 *   needed for cricket; ignored for other sports.
 */
export function allowsDraws(
  sport: string,
  providerLeague?: string | null,
): boolean {
  if (ALWAYS_DRAW_SPORTS.has(sport.toLowerCase())) return true;
  if (sport.toLowerCase() === "cricket") return cricketAllowsDraws(providerLeague);
  return false;
}
