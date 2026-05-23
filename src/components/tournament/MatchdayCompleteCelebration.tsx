"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Full-screen celebration overlay that fires when the user finishes picking
 * every match in a matchday window. SVG-only — no canvas-confetti dep, no
 * runtime cost when not showing. Brand palette: amber (ps-amber), ink, cream,
 * green for the World Cup-flavour pop.
 *
 * The trophy wiggles side-to-side; six firework bursts radiate from staggered
 * positions. Tap anywhere (or the X) to dismiss. The CTA routes to the next
 * matchday window when one exists, otherwise back to the windows index.
 *
 * Respects prefers-reduced-motion — animations stay subtle, no fireworks
 * flashing, just a fade-in.
 */
interface MatchdayCompleteCelebrationProps {
  open: boolean;
  matchdayName: string;
  /** Slug for the next window — if null, no "Next matchday" CTA. */
  nextWindowId: string | null;
  nextWindowName: string | null;
  onClose: () => void;
}

export function MatchdayCompleteCelebration({
  open,
  matchdayName,
  nextWindowId,
  nextWindowName,
  onClose,
}: MatchdayCompleteCelebrationProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${matchdayName} complete`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ps-text/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-ps-bg text-ps-text shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fireworks — absolutely positioned behind the content */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 motion-reduce:hidden"
        >
          <Firework x="12%" y="18%" delay={0} hue="amber" />
          <Firework x="85%" y="14%" delay={0.25} hue="green" />
          <Firework x="22%" y="58%" delay={0.5} hue="amber" />
          <Firework x="78%" y="62%" delay={0.75} hue="green" />
          <Firework x="50%" y="30%" delay={1.0} hue="amber" />
          <Firework x="50%" y="72%" delay={1.25} hue="green" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ps-chip/80 text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="relative z-[1] flex flex-col items-center px-6 pb-6 pt-10">
          {/* Trophy — key on open so closing+re-opening restarts the wiggle */}
          <div
            key={open ? "open" : "closed"}
            className="trophy-wiggle motion-reduce:animate-none"
          >
            <Trophy />
          </div>

          <p className="mt-3 font-serif italic text-base text-ps-text-sec">
            Picks in.
          </p>
          <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-ps-text">
            {matchdayName} complete
          </h2>
          <p className="mt-2 max-w-[280px] text-center text-sm text-ps-text-sec">
            Now you wait. Or get a head start on the next one.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2">
            {nextWindowId ? (
              <Link
                href={`/wc/picks/${nextWindowId}`}
                className="flex h-12 items-center justify-center rounded-xl bg-ps-amber text-base font-bold text-ps-text shadow transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {nextWindowName ?? "Next matchday"} →
              </Link>
            ) : (
              <Link
                href="/wc/picks"
                className="flex h-12 items-center justify-center rounded-xl bg-ps-amber text-base font-bold text-ps-text shadow transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                Back to all windows
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-ps-text-sec hover:text-ps-text"
            >
              Stay here
            </button>
          </div>
        </div>

        {/* Scoped animations. Kept here rather than globals.css so the
            celebration is fully self-contained. */}
        <style jsx>{`
          .trophy-wiggle {
            animation: trophy-wiggle 1.4s ease-in-out infinite;
            transform-origin: 50% 90%;
          }
          @keyframes trophy-wiggle {
            0%,
            100% {
              transform: rotate(-7deg) translateY(0);
            }
            25% {
              transform: rotate(0deg) translateY(-2px);
            }
            50% {
              transform: rotate(7deg) translateY(0);
            }
            75% {
              transform: rotate(0deg) translateY(-2px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Trophy ───────────────────────────────────────────────────────────────────

function Trophy() {
  // A stylised football trophy — globe + curved arms + plinth. Uses ps-amber
  // for the body so it sits in the brand palette.
  return (
    <svg
      width="76"
      height="96"
      viewBox="0 0 76 96"
      fill="none"
      aria-hidden="true"
    >
      {/* Globe top */}
      <ellipse cx="38" cy="22" rx="14" ry="12" fill="var(--ps-amber)" />
      <path
        d="M24 22 Q38 14 52 22"
        stroke="var(--ps-text)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      <ellipse
        cx="38"
        cy="22"
        rx="6"
        ry="12"
        stroke="var(--ps-text)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.35"
      />
      {/* Curved arms wrapping under the globe to form the cup shape */}
      <path
        d="M24 30 C18 38 18 48 24 56 L52 56 C58 48 58 38 52 30"
        fill="var(--ps-amber)"
      />
      <path
        d="M22 32 C16 42 18 54 28 60"
        stroke="var(--ps-amber-deep, #b45309)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M54 32 C60 42 58 54 48 60"
        stroke="var(--ps-amber-deep, #b45309)"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Stem */}
      <rect x="34" y="56" width="8" height="14" fill="var(--ps-amber)" />
      {/* Plinth */}
      <rect
        x="22"
        y="70"
        width="32"
        height="6"
        rx="1.5"
        fill="var(--ps-text)"
      />
      <rect
        x="18"
        y="76"
        width="40"
        height="8"
        rx="2"
        fill="var(--ps-text)"
      />
      {/* Shine */}
      <path
        d="M31 14 Q33 12 35 14"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ── Firework ─────────────────────────────────────────────────────────────────

function Firework({
  x,
  y,
  delay,
  hue,
}: {
  x: string;
  y: string;
  delay: number;
  hue: "amber" | "green";
}) {
  // 12 radial sparks. Each spark is an absolutely-positioned dot that scales
  // and translates outward, fading as it goes. We loop the whole thing every
  // 2.4s with a stagger so the screen never feels static.
  const color =
    hue === "amber" ? "var(--ps-amber)" : "var(--ps-green, #0aa86d)";
  const sparks = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      className="absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      <div
        className="firework-burst"
        style={{ animationDelay: `${delay}s` }}
      >
        {sparks.map((i) => (
          <span
            key={i}
            className="firework-spark"
            style={{
              background: color,
              transform: `rotate(${(i * 360) / 12}deg) translateY(-2px)`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        .firework-burst {
          position: relative;
          width: 0;
          height: 0;
          animation: burst 2.4s ease-out infinite;
          opacity: 0;
        }
        .firework-spark {
          position: absolute;
          left: 0;
          top: 0;
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          transform-origin: 0 32px;
          box-shadow: 0 0 6px currentColor;
        }
        @keyframes burst {
          0% {
            transform: scale(0.2);
            opacity: 1;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
          70% {
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
