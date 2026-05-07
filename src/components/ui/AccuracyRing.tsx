// Usage: <AccuracyRing value={0.74} /> <AccuracyRing value={0.52} size={48} />
interface AccuracyRingProps {
  value: number; // 0–1
  size?: number;
}

function ringColor(value: number): string {
  if (value >= 0.7) return 'var(--ps-green)';
  if (value >= 0.55) return 'var(--ps-amber)';
  return 'var(--ps-red)';
}

function ringTextClass(value: number): string {
  if (value >= 0.7) return 'text-ps-green';
  if (value >= 0.55) return 'text-ps-amber';
  return 'text-ps-red';
}

export function AccuracyRing({ value, size = 38 }: AccuracyRingProps) {
  const clampedValue = Math.min(1, Math.max(0, value));
  const pct = Math.round(clampedValue * 100);
  const color = ringColor(clampedValue);
  const textClass = ringTextClass(clampedValue);
  const trackColor = 'var(--ps-border-strong)';
  const thickness = Math.max(3, Math.round(size * 0.13));
  const innerSize = size - thickness * 2;
  const fontSize = Math.round(innerSize * 0.36);

  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${clampedValue * 360}deg, ${trackColor} 0deg)`,
      }}
      role="img"
      aria-label={`Accuracy ${pct}%`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold tabular-nums ${textClass}`}
        style={{
          width: innerSize,
          height: innerSize,
          background: 'var(--ps-surface)',
          fontSize,
        }}
      >
        {pct}
      </span>
    </span>
  );
}
