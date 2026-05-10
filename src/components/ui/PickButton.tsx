// Usage:
// <PickButton label="Man City" sub="Home" odds="4/6" selected={false} onClick={() => {}} />
// <PickButton label="Draw" odds="9/4" selected communityPct={34} onClick={() => {}} />
interface PickButtonProps {
  label: string;
  sub?: string;
  odds?: string;
  selected: boolean;
  disabled?: boolean;
  communityPct?: number;
  onClick: () => void;
}

export function PickButton({
  label,
  sub,
  odds,
  selected,
  disabled = false,
  communityPct,
  onClick,
}: PickButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'relative w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50 focus-visible:ring-offset-1 focus-visible:ring-offset-ps-surface',
        'motion-reduce:transition-none',
        selected
          ? 'bg-ps-amber-soft border-ps-amber'
          : 'bg-ps-surface border-ps-border',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer active:scale-[0.97]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {communityPct !== undefined && (
        <span
          className="absolute top-2 right-2.5 text-ps-text-ter"
          style={{ fontSize: 9 }}
          aria-label={`${communityPct}% of the group picked this`}
        >
          {communityPct}%
        </span>
      )}

      <span
        className="block font-bold text-ps-text leading-tight"
        style={{ fontSize: 12.5 }}
      >
        {label}
      </span>

      {sub && (
        <span
          className="block uppercase text-ps-text-sec font-semibold tracking-wide mt-0.5"
          style={{ fontSize: 9.5 }}
        >
          {sub}
        </span>
      )}

      {odds && (
        <span
          className="block text-ps-text-sec mt-1"
          style={{ fontSize: 11 }}
        >
          {odds}
        </span>
      )}
    </button>
  );
}
