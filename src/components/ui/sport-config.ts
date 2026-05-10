export type SportKey = 'soccer' | 'f1' | 'gaa' | 'nba' | 'golf' | 'rugby' | 'tennis' | 'horse_racing' | 'snooker' | 'cricket' | 'mlb' | 'nfl' | 'nhl';

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
    emoji: '⚽',
    from: '#2563eb',
    to: '#7c3aed',
    pillBg: 'rgba(37,99,235,0.12)',
    pillFg: '#1e40af',
    pillFgDark: '#a5b4fc',
    pillFgVar: 'var(--ps-soccer-pill-fg)',
  },
  f1: {
    name: 'Formula 1',
    emoji: '🏎️',
    from: '#dc2626',
    to: '#ea580c',
    pillBg: 'rgba(220,38,38,0.12)',
    pillFg: '#991b1b',
    pillFgDark: '#fca5a5',
    pillFgVar: 'var(--ps-f1-pill-fg)',
  },
  gaa: {
    name: 'GAA',
    emoji: '🏑',
    from: '#059669',
    to: '#047857',
    pillBg: 'rgba(5,150,105,0.12)',
    pillFg: '#065f46',
    pillFgDark: '#6ee7b7',
    pillFgVar: 'var(--ps-gaa-pill-fg)',
  },
  nba: {
    name: 'NBA',
    emoji: '🏀',
    from: '#d97706',
    to: '#dc2626',
    pillBg: 'rgba(217,119,6,0.12)',
    pillFg: '#92400e',
    pillFgDark: '#fcd34d',
    pillFgVar: 'var(--ps-nba-pill-fg)',
  },
  golf: {
    name: 'Golf',
    emoji: '⛳',
    from: '#4f46e5',
    to: '#7c3aed',
    pillBg: 'rgba(79,70,229,0.12)',
    pillFg: '#3730a3',
    pillFgDark: '#c4b5fd',
    pillFgVar: 'var(--ps-golf-pill-fg)',
  },
  rugby: {
    name: 'Rugby',
    emoji: '🏉',
    from: '#065f46',
    to: '#0d9488',
    pillBg: 'rgba(6,95,70,0.12)',
    pillFg: '#064e3b',
    pillFgDark: '#6ee7b7',
    pillFgVar: 'var(--ps-rugby-pill-fg)',
  },
  tennis: {
    name: 'Tennis',
    emoji: '🎾',
    from: '#ca8a04',
    to: '#65a30d',
    pillBg: 'rgba(202,138,4,0.12)',
    pillFg: '#854d0e',
    pillFgDark: '#fde047',
    pillFgVar: 'var(--ps-tennis-pill-fg)',
  },
  horse_racing: {
    name: 'Racing',
    emoji: '🏇',
    from: '#7c3aed',
    to: '#a855f7',
    pillBg: 'rgba(124,58,237,0.12)',
    pillFg: '#5b21b6',
    pillFgDark: '#c4b5fd',
    pillFgVar: 'var(--ps-horse_racing-pill-fg)',
  },
  cricket: {
    name: 'Cricket',
    emoji: '🏏',
    from: '#1e40af',
    to: '#059669',
    pillBg: 'rgba(30,64,175,0.12)',
    pillFg: '#1e3a8a',
    pillFgDark: '#93c5fd',
    pillFgVar: 'var(--ps-cricket-pill-fg)',
  },
  snooker: {
    name: 'Snooker',
    emoji: '🎱',
    from: '#166534',
    to: '#15803d',
    pillBg: 'rgba(22,101,52,0.12)',
    pillFg: '#14532d',
    pillFgDark: '#86efac',
    pillFgVar: 'var(--ps-snooker-pill-fg)',
  },
  mlb: {
    name: 'MLB',
    emoji: '⚾',
    from: '#1e3a5f',
    to: '#dc2626',
    pillBg: 'rgba(30,58,95,0.12)',
    pillFg: '#1e3a5f',
    pillFgDark: '#93c5fd',
    pillFgVar: 'var(--ps-mlb-pill-fg)',
  },
  nfl: {
    name: 'NFL',
    emoji: '🏈',
    from: '#1e3a5f',
    to: '#dc2626',
    pillBg: 'rgba(30,58,95,0.12)',
    pillFg: '#1e3a5f',
    pillFgDark: '#93c5fd',
    pillFgVar: 'var(--ps-nfl-pill-fg)',
  },
  nhl: {
    name: 'NHL',
    emoji: '🏒',
    from: '#0f172a',
    to: '#334155',
    pillBg: 'rgba(15,23,42,0.12)',
    pillFg: '#0f172a',
    pillFgDark: '#94a3b8',
    pillFgVar: 'var(--ps-nhl-pill-fg)',
  },
};

/** Map DB sport values to UI sport keys (handles formula_1 → f1 etc.) */
export function toSportKey(sport: string): SportKey {
  if (sport === 'formula_1') return 'f1';
  const lower = sport.toLowerCase() as SportKey;
  return lower in SPORT_CONFIG ? lower : 'soccer';
}
