/**
 * Per-sport result-checking timing config.
 *
 * checkAfterHours: how long after start_time before first result check
 * windowHours: how long after start_time before giving up (mark window_expired)
 *
 * These are defaults. Individual events can override via result_check_after
 * in the fixture YAML, which the ingest script writes to result_data.auto_result_check_after.
 */
export interface SportTiming {
  checkAfterHours: number;
  windowHours: number;
}

export const SPORT_TIMING: Record<string, SportTiming> = {
  gaa:          { checkAfterHours: 2,   windowHours: 26 },
  soccer:       { checkAfterHours: 2,   windowHours: 26 },
  rugby:        { checkAfterHours: 2.5, windowHours: 26 },
  tennis:       { checkAfterHours: 3,   windowHours: 26 },
  golf:         { checkAfterHours: 8,   windowHours: 30 },
  horse_racing: { checkAfterHours: 0.5, windowHours: 26 },
  cricket:      { checkAfterHours: 4,   windowHours: 72 },
  formula_1:    { checkAfterHours: 2,   windowHours: 26 },
  snooker:      { checkAfterHours: 3,   windowHours: 26 },
  athletics:    { checkAfterHours: 2,   windowHours: 26 },
  nfl:          { checkAfterHours: 3.5, windowHours: 26 },
  nba:          { checkAfterHours: 2.5, windowHours: 26 },
  nhl:          { checkAfterHours: 2.5, windowHours: 26 },
  mlb:          { checkAfterHours: 3.5, windowHours: 26 },
};

export const DEFAULT_TIMING: SportTiming = { checkAfterHours: 3, windowHours: 8 };

export function getTimingForSport(sport: string): SportTiming {
  return SPORT_TIMING[sport] ?? DEFAULT_TIMING;
}
