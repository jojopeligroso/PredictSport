"use client";

import { useState } from "react";
import { Bi } from "@/components/ligas/Bi";
import {
  BUCKET_LABELS,
  TOP_BUCKET,
  MAX_WINDOW_WIDTH,
  marginBonus,
  windowWidth,
  type MarginWindow,
} from "@/lib/ligas/system-b";

/**
 * MarginWindowBar — the "sitting bar" confidence selector.
 *
 * Six buckets (0, 1, 2, 3, 4, 5+) laid out as a bar. The entrant taps two
 * buckets to set a contiguous window; the tighter the window, the bigger the
 * bonus. Interaction: the first tap anchors a one-bucket window; the second
 * tap extends it to a range (clamped to a max width of 4); a third tap starts
 * over. Tapping the same bucket twice keeps a one-bucket call.
 *
 * Themed to the active league via the `liga` token (inherits from the enclosing
 * `ligaVars(...)` inline style).
 */

interface MarginWindowBarProps {
  /** Current window, or null when the entrant hasn't set one yet. */
  value: MarginWindow | null;
  onChange: (window: MarginWindow) => void;
  disabled?: boolean;
  /** Team the window is being called for — shown in the prompt. */
  teamLabel?: string;
}

function clampWindow(a: number, b: number): MarginWindow {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  // Cap the width at MAX_WINDOW_WIDTH, holding the most-recently-tapped edge (b).
  if (hi - lo + 1 > MAX_WINDOW_WIDTH) {
    if (b >= a) lo = hi - (MAX_WINDOW_WIDTH - 1);
    else hi = lo + (MAX_WINDOW_WIDTH - 1);
  }
  return { lo, hi };
}

export function MarginWindowBar({
  value,
  onChange,
  disabled = false,
  teamLabel,
}: MarginWindowBarProps) {
  // Anchor for the two-tap range selection. null → next tap starts fresh.
  const [anchor, setAnchor] = useState<number | null>(null);

  const handleTap = (i: number) => {
    if (disabled) return;
    if (anchor === null) {
      setAnchor(i);
      onChange({ lo: i, hi: i });
    } else {
      onChange(clampWindow(anchor, i));
      setAnchor(null);
    }
  };

  const width = value ? windowWidth(value) : 0;
  const bonus = value ? marginBonus(value) : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ps-text-sec">
          <Bi es="Margen a los 9" en="Margin after 9" />
          {teamLabel ? (
            <span className="text-ps-text-ter">
              {" · "}
              {teamLabel}
            </span>
          ) : null}
        </p>
        {value ? (
          <span className="font-mono text-micro font-bold text-liga-deep dark:text-liga">
            +{bonus}
          </span>
        ) : null}
      </div>

      {/* The bar */}
      <div
        className="mt-2 flex gap-1"
        role="group"
        aria-label="Margin window"
      >
        {BUCKET_LABELS.map((label, i) => {
          const inWindow = value != null && i >= value.lo && i <= value.hi;
          const isLo = value != null && i === value.lo;
          const isHi = value != null && i === value.hi;
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              aria-pressed={inWindow}
              onClick={() => handleTap(i)}
              className={[
                "relative h-11 flex-1 font-mono text-sm font-bold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none",
                // Rounding: round the outer edges of the selected window / each cell.
                isLo ? "rounded-l-xl" : "",
                isHi ? "rounded-r-xl" : "",
                !inWindow ? "rounded-lg" : "",
                inWindow
                  ? "bg-liga text-white"
                  : "bg-ps-bg-alt text-ps-text-sec hover:text-ps-text",
                i === TOP_BUCKET ? "" : "",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Live confidence readout / prompt */}
      <div className="mt-2 min-h-[1.25rem]">
        {value ? (
          <p className="text-xs text-ps-text-ter">
            {width === 1 ? (
              <Bi
                es={`Llamada más ajustada — +${bonus} si aciertas`}
                en={`Tightest call — +${bonus} if it lands`}
              />
            ) : (
              <Bi
                es={`Ventana de ${width} — +${bonus} si el margen cae dentro`}
                en={`${width}-wide window — +${bonus} if the margin lands inside`}
              />
            )}
          </p>
        ) : (
          <p className="text-xs text-ps-text-ter">
            <Bi
              es="Toca dos casillas para elegir tu rango. Más ajustado, más puntos."
              en="Tap two buckets to set your range. Tighter pays more."
            />
          </p>
        )}
      </div>
    </div>
  );
}
