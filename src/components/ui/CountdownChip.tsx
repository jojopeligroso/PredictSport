// Usage: <CountdownChip text="Locks in 2h 14m" /> <CountdownChip text="Locks in 4m" urgent />
interface CountdownChipProps {
  text: string;
  urgent?: boolean;
}

export function CountdownChip({ text, urgent = false }: CountdownChipProps) {
  const bgClass = urgent ? 'bg-ps-red-soft' : 'bg-ps-amber-soft';
  const textClass = urgent ? 'text-ps-red' : 'text-ps-amber';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 min-h-[44px] rounded-full text-xs font-semibold ${bgClass} ${textClass}`}
      role="timer"
      aria-live="polite"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M5.5 3v2.5l1.5 1"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{text}</span>
    </span>
  );
}
