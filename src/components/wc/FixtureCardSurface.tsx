import type { ReactNode } from "react";
import { HOST_CITIES, type HostCitySlug } from "@/lib/wc/host-cities";

/**
 * FixtureCardSurface — pure visual wrapper extracted from
 * src/app/wc/results/FixturesTabs.tsx → FixtureCard (lines 425–447).
 *
 * Renders the host-city-coloured article, a two-cell header
 * ("Group X · MDn" left, kickoff time + date right), and the body slot.
 * Knows nothing about picks, predictions, or any business logic — purely
 * the surface chrome.
 *
 * Used by:
 *  - WindowPickList (surface="card" variant, PR2) — the inline picks card.
 *  - Future WC surfaces that want the same look.
 *
 * The amber halo (ringClass) signals that the user has a saved prediction on
 * this fixture. The white inner-ring edge case from upcoming-fixtures.html
 * (for cards on amber/yellow backgrounds) is handled here so callers don't
 * need to think about it.
 *
 * Headers and body intentionally stripped of venue / dual-clock metadata —
 * that's the C1 mockup's "less information" rule.
 */

export interface FixtureCardSurfaceProps {
  city: HostCitySlug;
  /** Left chip in the header, e.g. "Group A · MD1". */
  headerLeft: ReactNode;
  /** Right chip in the header, typically time + date. */
  headerRight: ReactNode;
  /** When true, an amber halo wraps the card to signal a saved prediction. */
  hasPick?: boolean;
  /** Body content — the pick row, score inputs, etc. */
  children: ReactNode;
}

// Host-city slugs whose colour is amber/yellow-leaning enough that the amber
// halo would dissolve into the background. For these, FixturesTabs's
// upcoming-fixtures.html anchor uses an extra white inner ring to separate
// the halo from the surface. None of the current WC26 host cities are amber-
// dominant (Seattle #97961B comes closest, an olive-green), but we treat the
// edge case here for future-proofing.
const AMBER_LEANING_CITIES = new Set<HostCitySlug>([]);

export function FixtureCardSurface({
  city,
  headerLeft,
  headerRight,
  hasPick = false,
  children,
}: FixtureCardSurfaceProps) {
  const cityMeta = HOST_CITIES[city];
  const onAmber = AMBER_LEANING_CITIES.has(city);

  // Halo treatment — matches FixturesTabs.FixtureCard ringClass logic.
  // Outer amber halo + (for amber-leaning surfaces) an inner white separator.
  const haloClass = hasPick
    ? onAmber
      ? "shadow-[inset_0_0_0_2px_#fff,0_0_0_2px_rgba(245,158,11,0.7),0_1px_2px_rgba(0,0,0,0.15)]"
      : "shadow-[0_0_0_2px_rgba(245,158,11,0.5),0_1px_2px_rgba(0,0,0,0.15)]"
    : "shadow-sm";

  return (
    <article
      className={[
        "overflow-hidden rounded-xl text-white transition-all",
        haloClass,
      ].join(" ")}
      style={{ backgroundColor: cityMeta.color }}
    >
      <header className="flex items-center justify-between px-4 pt-3 text-[0.7rem] font-bold uppercase tracking-wide text-white/85">
        <span>{headerLeft}</span>
        <span className="text-right font-mono normal-case tracking-normal text-white/85">
          {headerRight}
        </span>
      </header>

      <div className="px-3 pb-3.5 pt-2">{children}</div>
    </article>
  );
}
