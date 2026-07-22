"use client";

/**
 * Collapsible — a themed <details>/<summary> disclosure for the winter-league
 * surface. Used to keep the most-common stats visible while tucking the more
 * obscure / advanced ones away by default. Inherits the active league accent
 * via the `liga` token.
 */

interface CollapsibleProps {
  title: React.ReactNode;
  /** Optional short hint shown on the right of the summary row. */
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({
  title,
  hint,
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-ps-border bg-ps-surface [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="font-display text-sm font-extrabold text-ps-text">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {hint ? (
            <span className="font-mono text-micro text-ps-text-ter">{hint}</span>
          ) : null}
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ps-text-ter transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-ps-border px-4 py-3">{children}</div>
    </details>
  );
}
