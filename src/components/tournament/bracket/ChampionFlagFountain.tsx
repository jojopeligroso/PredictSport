"use client";

/**
 * ChampionFlagFountain — subtle inline celebration for the bracket review's
 * champion hero. Renders the champion's flag with small firework bursts behind
 * it, then the 32 R32-bound flags drifting upward in a staggered loop like a
 * slow fountain. Reuses the burst keyframes/colours from
 * MatchdayCompleteCelebration so the brand feel matches.
 *
 * Subtle by design: low opacity, slow loop, small travel distance. Honours
 * prefers-reduced-motion (renders the static flag grid only).
 */

import { CountryFlag } from "@/components/CountryFlag";

interface ChampionFlagFountainProps {
  champion: string;
  /** Teams to render as bubbles. Caller passes the 32-team R32 list. */
  teams: string[];
}

export function ChampionFlagFountain({ champion, teams }: ChampionFlagFountainProps) {
  // Skip the champion from the fountain so the focal flag doesn't double-render.
  const fountainTeams = teams.filter((t) => t !== champion);
  // Cap at 24 bubbles to keep the loop visually clean on mobile. The full 31
  // would crowd the lane.
  const bubbles = fountainTeams.slice(0, 24);

  return (
    <div className="relative mx-auto mt-3 flex h-[120px] w-full max-w-[300px] items-end justify-center">
      {/* Fountain lane — flags drift up behind the focal champion flag.
          motion-reduce hides the lane so SR users only see the static flag. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-0 motion-reduce:hidden"
      >
        {bubbles.map((team, i) => {
          const delay = (i * 0.35) % 8; // 8s loop, staggered every 350ms
          // Spread across the lane width pseudo-randomly but deterministically
          // so the layout is stable between renders.
          const left = 8 + ((i * 37) % 84); // 8% .. 92%
          const drift = ((i * 13) % 7) - 3; // -3px .. +3px horizontal sway
          return (
            <span
              key={`${team}-${i}`}
              className="fountain-bubble absolute"
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                ["--drift" as string]: `${drift}px`,
              }}
            >
              <CountryFlag name={team} size={14} />
            </span>
          );
        })}
      </div>

      {/* Firework bursts — only 3, smaller than the matchday celebration,
          positioned behind the champion flag. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 motion-reduce:hidden"
      >
        <MiniBurst x="22%" y="48%" delay={0} hue="amber" />
        <MiniBurst x="78%" y="42%" delay={0.9} hue="green" />
        <MiniBurst x="50%" y="22%" delay={1.7} hue="amber" />
      </div>

      {/* Focal champion flag */}
      <div className="champion-pop relative z-[1] mb-1 motion-reduce:animate-none">
        <CountryFlag name={champion} size={56} />
      </div>

      <style jsx>{`
        .fountain-bubble {
          bottom: -16px;
          opacity: 0;
          animation: bubble-rise 8s linear infinite;
          will-change: transform, opacity;
        }
        @keyframes bubble-rise {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 0.55;
          }
          50% {
            transform: translate(var(--drift, 0), -64px) scale(1);
            opacity: 0.6;
          }
          85% {
            opacity: 0.3;
          }
          100% {
            transform: translate(0, -110px) scale(0.85);
            opacity: 0;
          }
        }
        .champion-pop {
          animation: champion-pop 3.2s ease-in-out infinite;
        }
        @keyframes champion-pop {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-3px) scale(1.04);
          }
        }
      `}</style>
    </div>
  );
}

// ── MiniBurst ────────────────────────────────────────────────────────────────

/**
 * Smaller, slower firework than the matchday overlay so it stays inside the
 * "subtle" budget. 8 sparks, soft glow, 3.2s loop.
 */
function MiniBurst({
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
  const color = hue === "amber" ? "var(--ps-amber)" : "var(--ps-green, #0aa86d)";
  const sparks = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div
      className="absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      <div className="mini-burst" style={{ animationDelay: `${delay}s` }}>
        {sparks.map((i) => (
          <span
            key={i}
            className="mini-spark"
            style={{
              background: color,
              transform: `rotate(${(i * 360) / 8}deg) translateY(-1px)`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        .mini-burst {
          position: relative;
          width: 0;
          height: 0;
          animation: mini-burst 3.2s ease-out infinite;
          opacity: 0;
        }
        .mini-spark {
          position: absolute;
          left: 0;
          top: 0;
          width: 3px;
          height: 3px;
          border-radius: 9999px;
          transform-origin: 0 18px;
          box-shadow: 0 0 4px currentColor;
        }
        @keyframes mini-burst {
          0% {
            transform: scale(0.2);
            opacity: 0.9;
          }
          40% {
            transform: scale(1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
