"use client";

/**
 * CascadeCard — wraps a child in a staggered slide-in-from-left animation.
 *
 * Uses CSS animation with a per-card delay via inline --stagger variable.
 * The parent container should have `overflow-hidden` to clip cards during entry.
 */
export function CascadeCard({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  // Cap at 8 so late cards don't feel laggy
  const cappedIndex = Math.min(index, 8);
  return (
    <div
      style={{
        opacity: 0,
        animation: `ps-cascade-in 500ms cubic-bezier(0.25, 1, 0.5, 1) forwards`,
        animationDelay: `${cappedIndex * 80}ms`,
      }}
    >
      {children}
    </div>
  );
}
