// Usage: <SportBar sport="soccer" /> <SportBar sport="f1" height={4} />
// Intended for use at the very top of a card (rounded-t-inherit assumed)
import { SPORT_CONFIG, type SportKey } from './sport-config';

interface SportBarProps {
  sport: SportKey;
  height?: number;
}

export function SportBar({ sport, height = 3 }: SportBarProps) {
  const { from, to } = SPORT_CONFIG[sport];

  return (
    <div
      className="w-full rounded-t-[inherit]"
      style={{
        height,
        background: `linear-gradient(to right, ${from}, ${to})`,
      }}
      aria-hidden="true"
    />
  );
}
