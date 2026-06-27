interface OracleDotProps {
  /** CSS width/height classes or inline size — defaults to w-7 h-auto */
  className?: string;
}

/**
 * Oracle Dot brand mark — outlined circle with amber inner dot and highlight.
 * Evokes a crystal ball / called shot. Bold, round, confident.
 *
 * Transparent background: outer ring is stroke-only (currentColor) so it
 * adapts to any theme without creating a visible filled background.
 * Amber dot stays amber in both modes.
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
      {/* Outer circle — stroke only so the background stays transparent */}
      {/* Uses currentColor: ink in light mode, cream in dark mode */}
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" fill="none" />

      {/* Inner amber dot — slightly left-of-center and below center */}
      {/* Amber stays the same in both light and dark modes */}
      <circle cx="22" cy="27" r="9" fill="#f59e0b" />

      {/* Highlight — uses currentColor to match the outer ring */}
      <circle cx="28" cy="21" r="3" fill="currentColor" />
    </svg>
  );
}
