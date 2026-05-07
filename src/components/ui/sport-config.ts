export type SportKey = 'soccer' | 'f1' | 'gaa' | 'nba' | 'golf';

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
    emoji: '🏁',
    from: '#dc2626',
    to: '#ea580c',
    pillBg: 'rgba(220,38,38,0.12)',
    pillFg: '#991b1b',
    pillFgDark: '#fca5a5',
    pillFgVar: 'var(--ps-f1-pill-fg)',
  },
  gaa: {
    name: 'GAA',
    emoji: '🇮🇪',
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
};
