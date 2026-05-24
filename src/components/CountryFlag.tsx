/**
 * CountryFlag — circular flag icon for WC 2026 nations.
 *
 * Pass a team name (the same string used in event_name / match props);
 * the component looks up the ISO code via flagCodeFor() and renders the
 * SVG from flagcdn.com clipped to a circle.
 *
 * Uses object-fit:cover on a 4:3-ish flagcdn source to fit the circle.
 * No transform scale: tested with vertical tricolors (CI, FR, IE) where
 * scaling up clips the side stripes and produces a misidentifiable flag.
 * An inset shadow softens the edge so the flag sits cleanly against
 * pale backgrounds.
 *
 * When the name is null, empty, or a TBD/playoff placeholder, renders a
 * neutral grey circle so the layout doesn't jump when teams are unknown.
 */

import { flagCodeFor, flagUrl } from '@/lib/tournament/country-codes';

interface CountryFlagProps {
  name: string | null | undefined;
  size?: number;
  className?: string;
}

export function CountryFlag({
  name,
  size = 24,
  className = '',
}: CountryFlagProps) {
  const code = flagCodeFor(name);
  const url = flagUrl(code);
  const label = name?.trim() || 'TBD';

  const wrapperStyle = {
    width: size,
    height: size,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
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
        loading="lazy"
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
