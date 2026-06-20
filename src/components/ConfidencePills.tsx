"use client";

interface ConfidencePillsProps {
  value: number | null;
  onChange: (level: number | null) => void;
  variant?: "compact" | "card";
}

const LEVELS = [
  { value: 1, label: "Hopeful" },
  { value: 2, label: "Leaning" },
  { value: 3, label: "Confident" },
  { value: 4, label: "V. Sure" },
  { value: 5, label: "Dead Cert" },
] as const;

/** Bottom-border accent per level: muted grey → bold red. */
const ACCENT_BORDER = [
  "border-b-gray-400",
  "border-b-amber-600/70",
  "border-b-amber-500",
  "border-b-orange-500",
  "border-b-red-500",
];

export function ConfidencePills({
  value,
  onChange,
  variant = "compact",
}: ConfidencePillsProps) {
  const isCard = variant === "card";

  return (
    <div className="mt-2.5 mb-0.5">
      <p
        className={`mb-1.5 text-center text-[10px] font-medium ${
          isCard ? "text-white/45" : "text-ps-text-ter"
        }`}
      >
        How sure are you?
      </p>
      <div
        className={`flex overflow-hidden rounded-lg border ${
          isCard ? "border-white/12" : "border-ps-border"
        }`}
      >
        {LEVELS.map((level, i) => {
          const selected = value === level.value;
          const isLast = i === LEVELS.length - 1;

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(selected ? null : level.value)}
              aria-pressed={selected}
              aria-label={`Confidence: ${level.label}`}
              className={[
                "flex-1 py-1.5 text-center text-[10px] leading-tight transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ps-amber/60",
                !isLast &&
                  (isCard
                    ? "border-r border-white/8"
                    : "border-r border-ps-border/40"),
                selected
                  ? [
                      "border-b-2 font-semibold",
                      ACCENT_BORDER[i],
                      isCard
                        ? "bg-white/10 text-white"
                        : "bg-ps-chip text-ps-text",
                    ].join(" ")
                  : isCard
                    ? "text-white/30 hover:text-white/50 hover:bg-white/5"
                    : "text-ps-text-ter hover:text-ps-text-sec hover:bg-ps-chip/60",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
