"use client";

/**
 * CascadeCard — wraps a child in a staggered entrance animation.
 *
 * The parent container should have `overflow-hidden` to clip cards during entry.
 *
 * Variants:
 *  - "normal" (default): slide-from-left, 500ms / 80ms — card surfaces
 *  - "slow": slide-from-left, 1000ms / 160ms — podium cards (50% speed)
 *  - "rise": fade + translateY, 400ms / 60ms — table rows, ranked lists
 */

const VARIANTS = {
  normal: { keyframes: "ps-cascade-in", duration: 500, stagger: 80 },
  slow: { keyframes: "ps-cascade-in", duration: 1000, stagger: 160 },
  rise: { keyframes: "ps-rise-in", duration: 400, stagger: 60 },
} as const;

export function CascadeCard({
  index,
  children,
  speed = "normal",
}: {
  index: number;
  children: React.ReactNode;
  speed?: keyof typeof VARIANTS;
}) {
  const { keyframes, duration, stagger } = VARIANTS[speed];
  // Cap at 8 so late cards don't feel laggy
  const cappedIndex = Math.min(index, 8);
  return (
    <div
      style={{
        opacity: 0,
        animation: `${keyframes} ${duration}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`,
        animationDelay: `${cappedIndex * stagger}ms`,
      }}
    >
      {children}
    </div>
  );
}
