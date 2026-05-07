// Usage: <MovementBadge mv={3} /> <MovementBadge mv={-1} /> <MovementBadge mv={0} />
interface MovementBadgeProps {
  mv: number;
}

export function MovementBadge({ mv }: MovementBadgeProps) {
  if (mv === 0) {
    return (
      <span className="text-ps-text-ter text-xs font-medium tabular-nums" aria-label="No change">
        —
      </span>
    );
  }

  if (mv > 0) {
    return (
      <span className="text-ps-green text-xs font-bold tabular-nums" aria-label={`Up ${mv}`}>
        ▲{mv}
      </span>
    );
  }

  return (
    <span className="text-ps-red text-xs font-bold tabular-nums" aria-label={`Down ${Math.abs(mv)}`}>
      ▼{Math.abs(mv)}
    </span>
  );
}
