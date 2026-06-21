"use client";

import { useState, useEffect } from "react";
import { CHROME_PALETTE } from "./brand-palette";
import type { JoinCutoffWarningState } from "@/lib/wc/join-cutoff";

/**
 * Soft join cutoff banner. State-machine driven by joinCutoffWarningState()
 * in src/lib/wc/join-cutoff.ts.
 *
 * Hidden when state === "none".
 *
 * Copy follows the pub-chalkboard personality rule in design/DESIGN-RULES.md
 * — cheeky, confident, never corporate-apologetic.
 */
const LS_KEY = "ps:joinClosed:dismissCount";
const MAX_DISMISSALS = 3;

export function JoinCutoffBanner({
  state,
  closeDateLabel,
}: {
  state: JoinCutoffWarningState;
  /** Pre-formatted "Sun 14 Jun" label so the banner stays a server-renderable
   *  client component (no Intl locale drift across hydration). */
  closeDateLabel: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    if (state !== "closed") return;
    try {
      const count = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10);
      if (count >= MAX_DISMISSALS) setExhausted(true);
    } catch {
      // localStorage unavailable (incognito, etc.) — show the banner
    }
  }, [state]);

  if (state === "none") return null;

  if (state === "closed") {
    if (dismissed || exhausted) return null;

    const handleDismiss = () => {
      setDismissed(true);
      try {
        const prev = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10);
        localStorage.setItem(LS_KEY, String(prev + 1));
      } catch {
        // localStorage unavailable — dismissed for this session only
      }
    };

    return (
      <div className="mx-auto mt-3 w-full max-w-[480px] px-4">
        <div
          className="relative flex gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 pr-8 text-xs leading-snug"
          style={{
            background: "rgba(40, 30, 20, 0.04)",
            borderColor: "var(--ps-text-ter, #8b8275)",
            color: "var(--ps-text-sec, #5e554a)",
          }}
        >
          <span aria-hidden="true">🔒</span>
          <p>
            <strong className="text-ps-text">Joins closed.</strong> The door
            shut on {closeDateLabel}. Existing members keep picking; no new
            faces from here.
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-micro opacity-40 transition-opacity hover:opacity-70"
            style={{ color: "var(--ps-text-sec, #5e554a)" }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (state === "day-of") {
    return (
      <div className="mx-auto mt-3 w-full max-w-[480px] px-4">
        <div
          className="flex gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-xs leading-snug"
          style={{
            background: "rgba(245, 158, 11, 0.10)",
            borderColor: "#d97706",
          }}
        >
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-micro font-extrabold"
            style={{ background: CHROME_PALETTE.warning, color: "#191512" }}
            aria-hidden="true"
          >
            !
          </span>
          <p className="text-ps-text-sec">
            <strong className="text-ps-text">Last day to join.</strong> Door
            shuts tonight at 19:00 UTC. Drag your mates in now.
          </p>
        </div>
      </div>
    );
  }

  // day-before
  return (
    <div className="mx-auto mt-3 w-full max-w-[480px] px-4">
      <div
        className="flex gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-xs leading-snug"
        style={{
          background: "rgba(212, 175, 55, 0.08)",
          borderColor: "#d4af37",
        }}
      >
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-micro font-extrabold"
          style={{ background: CHROME_PALETTE.warning, color: "#191512" }}
          aria-hidden="true"
        >
          !
        </span>
        <p className="text-ps-text-sec">
          <strong className="text-ps-text">Joins close tomorrow.</strong> Last
          chance is {closeDateLabel} 19:00 UTC. Anyone you want in this game
          needs to sign up now.
        </p>
      </div>
    </div>
  );
}
