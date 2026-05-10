/**
 * Sport styling configuration.
 *
 * All colors derive from the core palette (cream, ink, amber, green, red).
 * Sport distinction comes from emoji + name, not hue.
 * See design/README.md: "Avoid slot-machine gradients, shiny chrome."
 */

export type SportKey = 'soccer' | 'f1' | 'gaa' | 'nba' | 'golf' | 'rugby' | 'tennis' | 'horse_racing' | 'snooker' | 'cricket' | 'athletics' | 'mlb' | 'nfl' | 'nhl';

// Unified warm pill style — ink text on muted amber background.
// Sport differentiation is via emoji + label, not color.
const PILL_STYLE = {
  pillBg: 'rgba(40, 30, 20, 0.06)',
  pillFg: '#5e554a',
  pillFgDark: 'rgba(241, 236, 226, 0.62)',
  pillFgVar: 'var(--ps-text-sec)',
} as const;

// Subtle bar accent — warm ink tint, not per-sport gradients.
const BAR_STYLE = {
  from: '#8b8275',
  to: '#5e554a',
} as const;

export const SPORT_CONFIG: Record<
  SportKey,
  {
    name: string;
    emoji: string;
    from: string;
    to: string;
    pillBg: string;
    pillFg: string;
    pillFgDark: string;
    pillFgVar: string;
  }
> = {
  soccer: {
    name: 'Soccer',
    emoji: '\u26bd',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  f1: {
    name: 'Formula 1',
    emoji: '\ud83c\udfce\ufe0f',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  gaa: {
    name: 'GAA',
    emoji: '\ud83c\udfd1',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  nba: {
    name: 'NBA',
    emoji: '\ud83c\udfc0',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  golf: {
    name: 'Golf',
    emoji: '\u26f3',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  rugby: {
    name: 'Rugby',
    emoji: '\ud83c\udfc9',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  tennis: {
    name: 'Tennis',
    emoji: '\ud83c\udfbe',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  horse_racing: {
    name: 'Racing',
    emoji: '\ud83c\udfc7',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  snooker: {
    name: 'Snooker',
    emoji: '\ud83c\udfb1',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  cricket: {
    name: 'Cricket',
    emoji: '\ud83c\udfcf',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  athletics: {
    name: 'Athletics',
    emoji: '\ud83c\udfc3',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  mlb: {
    name: 'MLB',
    emoji: '\u26be',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  nfl: {
    name: 'NFL',
    emoji: '\ud83c\udfc8',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
  nhl: {
    name: 'NHL',
    emoji: '\ud83c\udfd2',
    ...BAR_STYLE,
    ...PILL_STYLE,
  },
};

/** Map DB sport values to UI sport keys (handles formula_1 -> f1 etc.) */
export function toSportKey(sport: string): SportKey {
  if (sport === 'formula_1') return 'f1';
  const lower = sport.toLowerCase() as SportKey;
  return lower in SPORT_CONFIG ? lower : 'soccer';
}
