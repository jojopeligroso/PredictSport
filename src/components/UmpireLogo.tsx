interface UmpireLogoProps {
  /** CSS width/height classes or inline size — defaults to w-7 h-auto */
  className?: string;
  /** Override stroke/fill ink colour (default: currentColor inherits from parent) */
  inkColor?: string;
  /** Override flag fill colour */
  flagColor?: string;
  /** Kept for backward compat — less used in outline-only style */
  creamColor?: string;
}

/**
 * GAA umpire mark — outline style figure raising a green flag.
 * Outline-only: thick ink strokes, transparent fill on body/hat.
 * Green flag (#0aa86d) is the only filled coloured element.
 * All ink strokes use currentColor so they adapt to dark mode automatically.
 *
 * viewBox 0 0 72 90
 *
 * Usage:
 *   <UmpireLogo className="w-8 h-auto" />
 *   <UmpireLogo className="w-8 h-auto" flagColor="#0aa86d" />
 */
export function UmpireLogo({
  className = "w-7 h-auto",
  inkColor,
  flagColor = "#0aa86d",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  creamColor,
}: UmpireLogoProps) {
  // inkColor prop overrides currentColor when explicitly set
  const stroke = inkColor ?? "currentColor";
  const fill = inkColor ?? "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 72 90"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/*
        ── Coat (bell/trapezoid shape) ──────────────────────────────────────
        Wide at bottom (~14 to ~58), narrowing to shoulders (~24 to ~48),
        with a slightly curved silhouette. Flat bottom line.
        Outline only — no fill.
      */}
      <path
        d="M24 42 Q14 50 12 62 L10 88 L62 88 L60 62 Q58 50 48 42"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/*
        ── Neck / collar ────────────────────────────────────────────────────
        Short rectangle between hat brim and coat shoulders.
      */}
      <rect
        x="29"
        y="34"
        width="14"
        height="9"
        rx="1"
        stroke={stroke}
        strokeWidth="3"
        fill="none"
      />

      {/*
        ── Hat brim ─────────────────────────────────────────────────────────
        Flat horizontal bar wider than the dome.
      */}
      <rect
        x="23"
        y="28"
        width="26"
        height="5"
        rx="1"
        stroke={stroke}
        strokeWidth="3"
        fill="none"
      />

      {/*
        ── Hat dome ─────────────────────────────────────────────────────────
        Rounded semi-ellipse sitting on top of the brim.
      */}
      <path
        d="M28 28 Q28 14 36 14 Q44 14 44 28"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/*
        ── Raised right arm + flagpole ──────────────────────────────────────
        Arm goes from right shoulder (~48, 44) diagonally up-right
        to the hand position (~56, 28), then the pole continues up-right
        to (~64, 10). Pole is a straight line; arm has slight elbow curve.
      */}
      <path
        d="M46 42 Q52 36 54 28"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Pole — thinner, continuing past hand up to flag */}
      <line
        x1="54"
        y1="28"
        x2="62"
        y2="8"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/*
        ── Hand circle at pole junction ─────────────────────────────────────
        Small filled circle where hand grips the pole.
      */}
      <circle cx="54" cy="28" r="3.5" fill={fill} />

      {/*
        ── Green flag ───────────────────────────────────────────────────────
        Slightly wavy rectangle attached near the top of the pole.
        The only filled coloured element.
      */}
      <path
        d="M62 8 Q68 6 72 9 Q70 13 72 17 Q68 15 62 18 Z"
        fill={flagColor}
        stroke={flagColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/*
        ── Coat buttons — 4 filled dots down center ─────────────────────────
        Vertically spaced from upper chest to lower torso.
      */}
      <circle cx="36" cy="54" r="2" fill={fill} />
      <circle cx="36" cy="63" r="2" fill={fill} />
      <circle cx="36" cy="72" r="2" fill={fill} />
      <circle cx="36" cy="81" r="2" fill={fill} />
    </svg>
  );
}
