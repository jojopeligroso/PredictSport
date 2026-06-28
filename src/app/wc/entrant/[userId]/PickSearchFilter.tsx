"use client";

interface PickSearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function PickSearchFilter({ value, onChange }: PickSearchFilterProps) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ps-text-ter"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx={11} cy={11} r={8} />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="Filter picks by team or fixture..."
        className="w-full rounded-lg border border-ps-border bg-ps-surface py-2.5 pl-9 pr-3 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
      />
    </div>
  );
}
