// Usage: <FormBadge letter="W" /> <FormBadge letter="L" size={18} />
interface FormBadgeProps {
  letter: 'W' | 'L' | 'P';
  size?: number;
}

const CONFIG = {
  W: {
    bgClass: 'bg-ps-green-soft',
    colorClass: 'text-ps-green',
    label: 'Win',
  },
  L: {
    bgClass: 'bg-ps-red-soft',
    colorClass: 'text-ps-red',
    label: 'Loss',
  },
  P: {
    bgClass: 'bg-ps-amber-soft',
    colorClass: 'text-ps-amber',
    label: 'Pending',
  },
} as const;

export function FormBadge({ letter, size = 22 }: FormBadgeProps) {
  const { bgClass, colorClass, label } = CONFIG[letter];

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold ${bgClass} ${colorClass}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-label={label}
    >
      {letter}
    </span>
  );
}
