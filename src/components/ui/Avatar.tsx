// Usage: <Avatar initials="JD" color="#2563eb" /> <Avatar initials="AB" color="#dc2626" size={40} ring="0 0 0 2px #f59e0b" />
interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
  ring?: string | null;
}

export function Avatar({ initials, color, size = 36, ring = null }: AvatarProps) {
  const fontSize = Math.round(size * 0.38);

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize,
        boxShadow: ring ?? undefined,
      }}
      aria-label={initials}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
