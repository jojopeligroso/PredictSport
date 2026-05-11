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
  gaa:          { checkAfterHours: 2,   windowHours: 5  },
  soccer:       { checkAfterHours: 2,   windowHours: 5  },
  rugby:        { checkAfterHours: 2.5, windowHours: 5  },
  tennis:       { checkAfterHours: 3,   windowHours: 10 },
  golf:         { checkAfterHours: 8,   windowHours: 14 },
  horse_racing: { checkAfterHours: 0.5, windowHours: 3  },
  cricket:      { checkAfterHours: 4,   windowHours: 72 },
  formula_1:    { checkAfterHours: 2,   windowHours: 4  },
  snooker:      { checkAfterHours: 3,   windowHours: 24 },
  athletics:    { checkAfterHours: 2,   windowHours: 8  },
  nfl:          { checkAfterHours: 3.5, windowHours: 6  },
  nba:          { checkAfterHours: 2.5, windowHours: 5  },
  nhl:          { checkAfterHours: 2.5, windowHours: 5  },
  mlb:          { checkAfterHours: 3.5, windowHours: 6  },
};

export const DEFAULT_TIMING: SportTiming = { checkAfterHours: 3, windowHours: 8 };

export function getTimingForSport(sport: string): SportTiming {
  return SPORT_TIMING[sport] ?? DEFAULT_TIMING;
}
