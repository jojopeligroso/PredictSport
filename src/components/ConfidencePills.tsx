"use client";

import Link from "next/link";
import { confidenceLabel } from "@/lib/reckons-copy";

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
        className={`mb-1.5 flex items-center justify-center gap-1 text-[10px] font-medium ${
          isCard ? "text-white/45" : "text-ps-text-ter"
        }`}
      >
        How sure are you?
        <Link
          href="/wc/rules#faq"
          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold ${
            isCard
              ? "border-white/20 text-white/30 hover:text-white/50"
              : "border-ps-border text-ps-text-ter hover:text-ps-amber"
          }`}
          aria-label="Learn about confidence levels"
        >
          ?
        </Link>
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

/** Colored micro-pill for displaying confidence level in results. */
const PILL_STYLES = [
  "bg-gray-400/15 text-gray-500 dark:bg-gray-400/20 dark:text-gray-300",
  "bg-amber-600/12 text-amber-700 dark:bg-amber-600/20 dark:text-amber-400",
  "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-red-500/12 text-red-600 dark:bg-red-500/20 dark:text-red-300",
];

export function ConfidenceMicroPill({ level }: { level: number }) {
  const label = confidenceLabel(level);
  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-tight ${PILL_STYLES[level - 1] ?? PILL_STYLES[0]}`}
    >
      {label}
    </span>
  );
}

/* ---------- ConfidenceIntroCard ---------- */

interface ConfidenceIntroCardProps {
  children: React.ReactNode; // the ConfidencePills component
  variant?: "compact" | "card";
  onDismiss: () => void; // called when user taps "Not for me"
}

export function ConfidenceIntroCard({
  children,
  variant = "compact",
  onDismiss,
}: ConfidenceIntroCardProps) {
  const isCard = variant === "card";

  return (
    <div
      className={[
        "mt-2.5 mb-0.5 rounded-lg border p-3 animate-in slide-in-from-bottom-2 duration-300",
        isCard
          ? "border-white/12 bg-white/5"
          : "border-ps-amber/30 bg-ps-amber/5",
      ].join(" ")}
    >
      {/* UNLOCKED badge */}
      <span
        className={[
          "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
          isCard
            ? "bg-white/20 text-white"
            : "bg-ps-amber px-2 py-0.5 text-[#191512]",
        ].join(" ")}
      >
        Unlocked
      </span>

      {/* Copy */}
      <p
        className={`mt-1.5 text-xs font-semibold ${isCard ? "text-white" : "text-ps-text"}`}
      >
        How sure are you?
      </p>
      <p
        className={`mt-0.5 text-[11px] leading-relaxed ${isCard ? "text-white/60" : "text-ps-text-sec"}`}
      >
        Tap a level and your group will see it after the match.
      </p>

      {/* The actual ConfidencePills */}
      {children}

      {/* Dismiss link */}
      <div className="mt-1.5 text-right">
        <button
          type="button"
          onClick={onDismiss}
          className={`text-[10px] ${isCard ? "text-white/30 hover:text-white/50" : "text-ps-text-ter hover:text-ps-text-sec"}`}
        >
          Not for me
        </button>
      </div>
    </div>
  );
}

/* ---------- ConfidenceBreadcrumb ---------- */

export function ConfidenceBreadcrumb({
  onRestore,
  variant = "compact",
}: {
  onRestore: () => void;
  variant?: "compact" | "card";
}) {
  const isCard = variant === "card";

  return (
    <button
      type="button"
      onClick={onRestore}
      className={`mt-2 flex items-center gap-1 text-[10px] ${
        isCard
          ? "text-white/30 hover:text-white/50"
          : "text-ps-text-ter hover:text-ps-amber"
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
      Add conviction
    </button>
  );
}
