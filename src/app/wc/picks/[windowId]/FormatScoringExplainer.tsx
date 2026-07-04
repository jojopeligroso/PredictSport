"use client";

import { useState } from "react";

/**
 * Collapsible card showing Format classification scoring rules.
 * Only rendered when the user is still active in the Format classification.
 */
export function FormatScoringExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="mt-2 w-full rounded-xl border border-ps-border bg-ps-surface px-4 py-2.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ps-text-sec">
          Full-time predictions only — tap to learn more
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-ps-text-ter transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {open && (
        <ul className="mt-2 space-y-1 border-t border-ps-border pt-2 text-xs text-ps-text-sec">
          <li>
            <span className="font-mono font-semibold text-ps-text">3 pts</span>{" "}
            — exact score
          </li>
          <li>
            <span className="font-mono font-semibold text-ps-text">2 pts</span>{" "}
            — correct win / draw / loss
          </li>
          <li>
            <span className="font-mono font-semibold text-ps-text">1 pt</span>{" "}
            — who advances
          </li>
        </ul>
      )}
    </button>
  );
}
