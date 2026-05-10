// Usage: <Avatar initials="JD" color="#2563eb" /> <Avatar initials="AB" color="#dc2626" size={40} ring="0 0 0 2px #f59e0b" />
// avatarColor(str) — deterministic brand-palette color from any string
export const AVATAR_PALETTE = [
  '#1e40af', // blue-800
  '#065f46', // green-800
  '#7c3aed', // violet-700
  '#b45309', // amber-700
  '#9f1239', // rose-800
  '#0e7490', // cyan-700
  '#4338ca', // indigo-700
  '#166534', // green-800
  '#be185d', // pink-700
  '#1d4ed8', // blue-700
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

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
