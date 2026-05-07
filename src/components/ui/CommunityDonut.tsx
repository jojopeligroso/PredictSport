// Usage: <CommunityDonut community={{ "Team A": 14, "Draw": 5, "Team B": 8 }} />
// Usage: <CommunityDonut community={{ Yes: 20, No: 10 }} size={64} />
interface CommunityDonutProps {
  community: Record<string, number>;
  size?: number;
}

const PALETTE = [
  '#3b82f6',
  '#f59e0b',
  '#0aa86d',
  '#e23d4f',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

export function CommunityDonut({ community, size = 56 }: CommunityDonutProps) {
  const entries = Object.entries(community);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  const thickness = Math.max(4, Math.round(size * 0.15));
  const innerSize = size - thickness * 2;
  const labelFontSize = Math.round(innerSize * 0.28);
  const subFontSize = Math.max(8, Math.round(innerSize * 0.22));

  let conicParts: string[] = [];
  if (total === 0) {
    conicParts = [`var(--ps-border-strong) 0deg 360deg`];
  } else {
    let accumulated = 0;
    entries.forEach(([, count], i) => {
      const degrees = (count / total) * 360;
      const color = PALETTE[i % PALETTE.length];
      conicParts.push(`${color} ${accumulated}deg ${accumulated + degrees}deg`);
      accumulated += degrees;
    });
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${conicParts.join(', ')})`,
      }}
      role="img"
      aria-label={`Community picks: ${total} total`}
    >
      <span
        className="inline-flex flex-col items-center justify-center rounded-full"
        style={{
          width: innerSize,
          height: innerSize,
          background: 'var(--ps-surface)',
        }}
      >
        <span
          className="font-bold text-ps-text tabular-nums leading-none"
          style={{ fontSize: labelFontSize }}
        >
          {total}
        </span>
        <span
          className="text-ps-text-ter uppercase tracking-wide leading-none mt-px"
          style={{ fontSize: subFontSize }}
        >
          picks
        </span>
      </span>
    </span>
  );
}
