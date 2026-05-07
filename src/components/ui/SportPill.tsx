// Usage: <SportPill sport="soccer" /> <SportPill sport="f1" size="sm" />
import { SPORT_CONFIG, type SportKey } from './sport-config';

interface SportPillProps {
  sport: SportKey;
  size?: 'sm' | 'md';
}

export function SportPill({ sport, size = 'md' }: SportPillProps) {
  const cfg = SPORT_CONFIG[sport];

  const paddingClass = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const textClass = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const gapClass = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <span
      className={`inline-flex items-center ${gapClass} ${paddingClass} ${textClass} font-bold uppercase tracking-wide rounded-full`}
      style={{ background: cfg.pillBg, color: cfg.pillFgVar }}
    >
      <span aria-hidden="true">{cfg.emoji}</span>
      <span>{cfg.name}</span>
    </span>
  );
}
