/**
 * LeagueMark — original, house-style emblems for each winter league.
 *
 * IMPORTANT: these are ORIGINAL marks, not the official league logos. Official
 * league logos are third-party trademarks and are deliberately not reproduced
 * here. Each mark is a single-colour `currentColor` SVG so it inverts cleanly
 * in dark mode (same convention as the sportspredict BrandMark family).
 *
 * A baseball ring unifies the set; a per-league motif distinguishes each:
 *   lmp   → Pacific wave       (Liga Mexicana del Pacífico)
 *   lvbp  → star               (Liga Venezolana de Béisbol Profesional)
 *   lidom → infield diamond    (Liga Dominicana)
 *   lbprc → crossed bats + ball (Liga Roberto Clemente, Puerto Rico)
 *   sdc   → crown              (Serie del Caribe — the Caribbean crown)
 *
 * viewBox 0 0 48 48. Usage: <LeagueMark slug="lmp" className="h-8 w-8" />
 */

interface LeagueMarkProps {
  slug: string;
  className?: string;
}

/** Baseball ring shared by every mark. */
function Ring() {
  return (
    <circle
      cx="24"
      cy="24"
      r="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    />
  );
}

/** Faint seam arcs hugging the left/right inner edge — the "baseball" tell. */
function Seams() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55">
      <path d="M34 8 A20 20 0 0 1 34 40" />
      <path d="M14 8 A20 20 0 0 0 14 40" />
    </g>
  );
}

function Mark({ slug, className = "h-8 w-8" }: LeagueMarkProps) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 48 48",
    className,
    "aria-hidden": true as const,
  };

  switch (slug) {
    case "lmp":
      return (
        <svg {...common}>
          <Ring />
          <Seams />
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M13 20q3-3.5 6 0t6 0 6 0" />
            <path d="M13 26q3-3.5 6 0t6 0 6 0" />
          </g>
        </svg>
      );

    case "lvbp":
      return (
        <svg {...common}>
          <Ring />
          <Seams />
          <path
            fill="currentColor"
            d="M24 13 26.59 20.44 34.46 20.6 28.18 25.36 30.47 32.9 24 28.4 17.53 32.9 19.82 25.36 13.54 20.6 21.41 20.44Z"
          />
        </svg>
      );

    case "lidom":
      return (
        <svg {...common}>
          <Ring />
          <path
            d="M24 12 36 24 24 36 12 24Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="2.4" fill="currentColor" />
        </svg>
      );

    case "lbprc":
      return (
        <svg {...common}>
          <Ring />
          <Seams />
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <path d="M16 33 31 18" />
            <path d="M32 33 17 18" />
          </g>
          <circle cx="24" cy="14.5" r="2.8" fill="currentColor" />
        </svg>
      );

    case "sdc":
      return (
        <svg {...common}>
          <Ring />
          <Seams />
          <path
            fill="currentColor"
            d="M14 31 13 20 19 25 24 17 29 25 35 20 34 31Z"
          />
          <circle cx="19" cy="25" r="1.5" fill="currentColor" />
          <circle cx="24" cy="17" r="1.5" fill="currentColor" />
          <circle cx="29" cy="25" r="1.5" fill="currentColor" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <Ring />
          <Seams />
        </svg>
      );
  }
}

export function LeagueMark({ slug, className }: LeagueMarkProps) {
  return <Mark slug={slug} className={className} />;
}
