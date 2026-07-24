import { LEAGUE_BY_SLUG } from "@/components/ligas/leagues";
import { LeagueMark } from "@/components/ligas/LeagueMark";

/**
 * League identity for the /ligasinvernales surface.
 *
 * Mirrors MLB's "ligas invernales" treatment, where each league is fronted by
 * a large circular national flag. Resolution order:
 *   1. Official league logo, if supplied (meta.logo — see
 *      public/logos/ligas/README.md). Lets official media packs override.
 *   2. Circular national flag (the default identity, matching mlb.com).
 *   3. House-style <LeagueMark> in a tinted disc — used for leagues with no
 *      single national flag (e.g. Serie del Caribe).
 *
 * Uses a plain <img> (not next/image) to match the project's flag convention
 * and to serve official SVG/PNG assets untouched.
 */

interface LeagueIdentityProps {
  slug: string;
  /** Rendered diameter in px. Default 48. */
  size?: number;
  /** Extra classes on the outer element. */
  className?: string;
  /** Accessible label; defaults to the league's English name. */
  alt?: string;
}

export function LeagueIdentity({
  slug,
  size = 48,
  className = "",
  alt,
}: LeagueIdentityProps) {
  const meta = LEAGUE_BY_SLUG[slug];
  const label = alt ?? meta?.nameEn ?? slug;

  const ringStyle = {
    width: size,
    height: size,
    boxShadow:
      "inset 0 0 0 0.75px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.16)",
  } as const;

  // 1. Official logo (drop-in): contained on a white disc so logos supplied on
  //    a white background read cleanly in both light and dark mode. (Inline
  //    background avoids the bg-white utility flagged for interactive elements.)
  if (meta?.logo) {
    return (
      <span
        className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
        style={{ ...ringStyle, backgroundColor: "#fff" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.logo}
          alt={label}
          loading="eager"
          decoding="async"
          className="h-[84%] w-[84%] object-contain"
        />
      </span>
    );
  }

  // 2. Circular national flag (default identity — matches mlb.com/es/ligas-invernales).
  if (meta?.flag) {
    return (
      <span
        className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
        style={ringStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.flag}
          alt={`${meta.countryEn} flag`}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
    );
  }

  // 3. House-style mark on a tinted disc (e.g. Serie del Caribe — no single flag).
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full bg-liga/12 text-liga-deep dark:text-liga ${className}`}
      style={{ width: size, height: size }}
    >
      <LeagueMark slug={slug} className="h-[62%] w-[62%]" />
    </span>
  );
}

interface LigaFlagProps {
  slug: string;
  /** Diameter in px. Default 22. */
  size?: number;
  className?: string;
}

/**
 * LigaFlag — small circular national-flag badge. Renders nothing when the
 * league has no national flag (e.g. Serie del Caribe).
 */
export function LigaFlag({ slug, size = 22, className = "" }: LigaFlagProps) {
  const meta = LEAGUE_BY_SLUG[slug];
  if (!meta?.flag) return null;

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow:
          "inset 0 0 0 0.5px rgba(255,255,255,0.7), 0 1px 1.5px rgba(0,0,0,0.18)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meta.flag}
        alt={`${meta.countryEn} flag`}
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
