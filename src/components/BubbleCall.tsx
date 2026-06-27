interface BubbleCallProps {
  /** CSS width/height classes or inline size — defaults to w-7 h-auto */
  className?: string;
}

/**
 * Bubble Call brand mark — outlined speech bubble with amber checkmark inside.
 * Tail points bottom-left. Punchy and social — "calling your prediction".
 *
 * Transparent background: bubble is stroke-only (currentColor) so it
 * adapts to any theme without creating a visible filled background.
 * Amber checkmark stays amber in both modes.
 *
 * viewBox 0 0 44 44
 *
 * Usage:
 *   <BubbleCall className="w-10 h-10" />
 */
export function BubbleCall({ className = "w-7 h-auto" }: BubbleCallProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 44 44"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/*
        Speech bubble body — rounded rect with triangular tail bottom-left.
        Stroke-only so the background stays transparent on any theme.
        Uses currentColor: ink (#191512) in light mode, cream (#f1ece2) in dark mode.
      */}
      <path
        d="
          M8 4
          H36
          Q40 4 40 8
          V28
          Q40 32 36 32
          H16
          L8 40
          V32
          H8
          Q4 32 4 28
          V8
          Q4 4 8 4
          Z
        "
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Amber checkmark — centered in the bubble body (y=8 to y=28) */}
      {/* Amber stays the same in both light and dark modes */}
      <polyline
        points="13,18 19,25 31,12"
        stroke="#f59e0b"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
