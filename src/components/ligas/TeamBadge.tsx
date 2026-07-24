import { monogramFor, teamMetaFor } from "@/components/ligas/teams";

/**
 * TeamBadge — a team's identity chip.
 *
 * Renders the official team logo when one has been supplied (see
 * public/logos/teams/README.md and teams.ts `logo`), otherwise a monogram disc
 * tinted in the current league accent — echoing the lettermark badges in the
 * official standings graphics (e.g. "GC", "E", "T").
 *
 * Expects a league accent in scope via `ligaVars` (the `liga` tokens); falls
 * back to amber otherwise.
 */

interface TeamBadgeProps {
  /** Team name (may be accented); used for lookup + monogram derivation. */
  name: string;
  /** Diameter in px. Default 32. */
  size?: number;
  className?: string;
}

export function TeamBadge({ name, size = 32, className = "" }: TeamBadgeProps) {
  const meta = teamMetaFor(name);

  if (meta?.logo) {
    return (
      <span
        className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: "#fff",
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.logo}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-[84%] w-[84%] object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full bg-liga/15 font-mono font-bold uppercase leading-none tracking-tight text-liga-deep dark:text-liga ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {monogramFor(name)}
    </span>
  );
}
