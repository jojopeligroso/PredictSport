// Usage: <SectionHeader label="Leaderboard" /> <SectionHeader label="Recent Picks" accent="var(--ps-green)" />
interface SectionHeaderProps {
  label: string;
  accent?: string;
}

export function SectionHeader({ label, accent = 'var(--ps-amber)' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="shrink-0 rounded-sm"
        style={{ width: 4, height: 18, background: accent }}
        aria-hidden="true"
      />
      <span className="text-xs font-bold uppercase tracking-widest text-ps-text-sec">
        {label}
      </span>
    </div>
  );
}
