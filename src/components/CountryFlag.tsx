/**
 * CountryFlag — flag icon for WC 2026 nations.
 *
 * Two shapes:
 *   - 'circle' (default, legacy): round badge, object-cover. Side stripes of
 *     vertical tricolors (FR, CI, IE) get clipped — accepted trade for
 *     avatar-style alignment.
 *   - 'pill': "flag" shape from the FIFA 2026 poster — three square corners
 *     with one large rounded top-right corner (fluttering-flag /
 *     page-curl silhouette). Implemented with `clip-path: path(...)` on
 *     the wrapper so the mask is exact at any size. 4:3 ratio.
 *
 * When the name is null, empty, or a TBD/playoff placeholder, renders a
 * neutral placeholder (greyed disc or pill) so the layout doesn't jump.
 * If `placeholder` is set ("1B", "W73", "EFGJ"), the pill variant renders
 * that label in mono — matching the poster's slot pills.
 */

import { flagCodeFor, flagUrl } from '@/lib/tournament/country-codes';

type FlagShape = 'circle' | 'pill';

interface CountryFlagProps {
  name: string | null | undefined;
  size?: number; // for circle: diameter. for pill: width (height = size * 3/4).
  shape?: FlagShape;
  placeholder?: string | null; // e.g. "1B", "W73"; only used by pill variant
  className?: string;
}

export function CountryFlag({
  name,
  size = 24,
  shape = 'circle',
  placeholder = null,
  className = '',
}: CountryFlagProps) {
  const code = flagCodeFor(name);
  const url = flagUrl(code);
  const label = name?.trim() || 'TBD';

  if (shape === 'pill') {
    const width = size;
    const height = Math.round((size * 3) / 4);
    // Rotationally-symmetric "flag" shape from the FIFA poster:
    // top-right and bottom-left corners rounded, top-left and bottom-right sharp.
    // Radius ~ 35% of width matches the poster's bold arc.
    const r = Math.round(width * 0.35);

    // Two clip paths produce the visible white hairline border:
    //   - outerClip: full silhouette, fills white.
    //   - innerClip: inset by BORDER on all sides, clips the flag image.
    // The visible white ring between the two paths = the stroke.
    // The inner radius shrinks by BORDER so the curve thickness stays even.
    const BORDER = Math.max(1, Math.round(size * 0.025));
    const innerW = width - BORDER * 2;
    const innerH = height - BORDER * 2;
    const innerR = Math.max(1, r - BORDER);

    const flagPath = (w: number, h: number, rr: number) =>
      `path('M 0 0 L ${w - rr} 0 A ${rr} ${rr} 0 0 1 ${w} ${rr} L ${w} ${h} L ${rr} ${h} A ${rr} ${rr} 0 0 1 0 ${h - rr} Z')`;

    const outerClip = flagPath(width, height, r);
    const innerClip = flagPath(innerW, innerH, innerR);

    const outerStyle = {
      width,
      height,
      clipPath: outerClip,
      WebkitClipPath: outerClip,
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))',
    } as const;

    const innerStyle = {
      position: 'absolute' as const,
      top: BORDER,
      left: BORDER,
      width: innerW,
      height: innerH,
      clipPath: innerClip,
      WebkitClipPath: innerClip,
      overflow: 'hidden' as const,
    };

    if (placeholder) {
      return (
        <span
          aria-label={`Slot ${placeholder}`}
          role="img"
          className={`relative inline-block shrink-0 bg-white ${className}`}
          style={outerStyle}
        >
          <span
            className="flex items-center justify-center bg-white text-ps-ink"
            style={innerStyle}
          >
            <span
              className="font-mono font-semibold leading-none"
              style={{ fontSize: Math.max(9, Math.round(innerH * 0.42)) }}
            >
              {placeholder}
            </span>
          </span>
        </span>
      );
    }

    if (!url) {
      return (
        <span
          aria-label={`${label} flag (unknown)`}
          role="img"
          className={`relative inline-block shrink-0 bg-white ${className}`}
          style={outerStyle}
        >
          <span className="block bg-ps-chip" style={innerStyle} />
        </span>
      );
    }

    return (
      <span
        className={`relative inline-block shrink-0 bg-white ${className}`}
        style={outerStyle}
      >
        <span className="block bg-white" style={innerStyle}>
          <img
            src={url}
            alt={`${label} flag`}
            loading="eager"
            decoding="async"
            width={innerW}
            height={innerH}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.88) brightness(0.96)' }}
          />
        </span>
      </span>
    );
  }

  // circle (legacy / project-wide default)
  // 0.5px white hairline = half-thickness of the WC pill border. On 2×
  // displays this renders as one device pixel — crisp. On 1× displays the
  // browser snaps to ~1px, which is acceptable degradation. Replaces the
  // older near-invisible inset shadow.
  const wrapperStyle = {
    width: size,
    height: size,
    boxShadow:
      'inset 0 0 0 0.5px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0, 0, 0, 0.15)',
  } as const;

  if (!url) {
    return (
      <span
        aria-label={`${label} flag (unknown)`}
        role="img"
        className={`inline-block shrink-0 rounded-full bg-ps-chip ${className}`}
        style={wrapperStyle}
      />
    );
  }

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={wrapperStyle}
    >
      <img
        src={url}
        alt={`${label} flag`}
        loading="eager"
        decoding="async"
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
