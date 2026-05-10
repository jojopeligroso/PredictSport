interface OracleDotProps {
  /** CSS width/height classes or inline size — defaults to w-7 h-auto */
  className?: string;
}

/**
 * Oracle Dot brand mark — ink circle with amber inner dot and highlight.
 * Evokes a crystal ball / called shot. Bold, round, confident.
 *
 * Dark mode: outer circle inverts to cream (via currentColor on --ps-text),
 * amber dot stays amber, highlight uses --ps-bg (background colour).
 *
 * viewBox 0 0 48 48
 *
 * Usage:
 *   <OracleDot className="w-10 h-10" />
 */
export function OracleDot({ className = "w-7 h-auto" }: OracleDotProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Outer circle — uses currentColor so it inverts in dark mode */}
      {/* Light mode: text is #191512 (ink). Dark mode: text is #f1ece2 (cream). */}
      <circle cx="24" cy="24" r="23" fill="currentColor" />

      {/* Inner amber dot — slightly left-of-center and below center */}
      {/* Amber stays the same in both light and dark modes */}
      <circle cx="22" cy="27" r="9" fill="#f59e0b" />

      {/* Highlight — uses --ps-bg so it contrasts with both circle colours */}
      {/* Light mode: bg is cream #efe9de. Dark mode: bg is dark #0e1116. */}
      <circle cx="28" cy="21" r="3" fill="var(--ps-bg)" />
    </svg>
  );
}
