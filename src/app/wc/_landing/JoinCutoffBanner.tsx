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
export function JoinCutoffBanner({
  state,
  closeDateLabel,
}: {
  state: JoinCutoffWarningState;
  /** Pre-formatted "Sun 14 Jun" label so the banner stays a server-renderable
   *  client component (no Intl locale drift across hydration). */
  closeDateLabel: string;
}) {
  if (state === "none") return null;

  if (state === "closed") {
    return (
      <div className="mx-auto mt-3 w-full max-w-[480px] px-4">
        <div
          className="flex gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-xs leading-snug"
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
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
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
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
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
