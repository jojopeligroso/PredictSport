// Usage: <PointsStamp earned={3} max={5} state="correct" />
// Usage: <PointsStamp earned={0} max={5} state="wrong" />
// Usage: <PointsStamp earned={2} max={5} state="partial" />
interface PointsStampProps {
  earned: number;
  max: number;
  state: 'correct' | 'wrong' | 'partial';
}

const GRADIENT: Record<PointsStampProps['state'], string> = {
  correct: 'linear-gradient(135deg, #0aa86d, #059669)',
  wrong: 'linear-gradient(135deg, #e23d4f, #be123c)',
  partial: 'linear-gradient(135deg, #f59e0b, #d97706)',
};

const LABEL: Record<PointsStampProps['state'], string> = {
  correct: 'Correct',
  wrong: 'Wrong',
  partial: 'Partial',
};

export function PointsStamp({ earned, max, state }: PointsStampProps) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold text-white tabular-nums"
      style={{ background: GRADIENT[state] }}
      aria-label={`${LABEL[state]}: ${earned} of ${max} points`}
    >
      <span className="font-display font-extrabold">+{earned}</span>
      <span className="opacity-70">/</span>
      <span className="opacity-70">{max}</span>
    </span>
  );
}
