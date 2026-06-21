// Usage: <SectionHeader label="Leaderboard" /> <SectionHeader label="Recent Picks" accent="var(--ps-green)" />
interface SectionHeaderProps {
  label: string;
  accent?: string;
}

export function SectionHeader({ label, accent = 'var(--ps-amber)' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ps-text-ter">
        {label}
      </span>
    </div>
  );
}
