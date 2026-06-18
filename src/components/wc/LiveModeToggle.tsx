"use client";

import { useT } from "@/lib/i18n";

interface LiveModeToggleProps {
  liveEnabled: boolean;
  onToggle: () => void;
  showPrompt: boolean;
  onAcceptAlwaysOff: () => void;
  onDeclinePrompt: () => void;
}

/**
 * Compact "Live mode" switch shown on the dashboard only while a match is live.
 * Defaults on; turning it off reverts the dashboard to its idle presentation.
 * After repeated off-toggles, an inline prompt offers to make it always-off.
 */
export function LiveModeToggle({
  liveEnabled,
  onToggle,
  showPrompt,
  onAcceptAlwaysOff,
  onDeclinePrompt,
}: LiveModeToggleProps) {
  const t = useT();

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-sec">
          <span
            className="h-1.5 w-1.5 rounded-full bg-ps-red"
            style={{ animation: liveEnabled ? "pulse-live 2s infinite" : undefined }}
          />
          {t("dash.live_mode")}
        </span>
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={liveEnabled}
          aria-label={t("dash.live_mode")}
          className="inline-flex items-center"
        >
          <span
            className={[
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              liveEnabled ? "bg-ps-amber" : "bg-ps-border",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                liveEnabled ? "translate-x-[18px]" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
        </button>
      </div>

      {showPrompt && (
        <div className="mt-1.5 rounded-xl border border-ps-border bg-ps-chip px-3 py-2.5">
          <p className="text-xs font-medium text-ps-text">
            {t("dash.live_mode_always_off_q")}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onAcceptAlwaysOff}
              className="rounded-lg bg-ps-text px-3 py-1.5 text-[11px] font-semibold text-ps-bg transition-opacity hover:opacity-90"
            >
              {t("dash.live_mode_keep_off")}
            </button>
            <button
              type="button"
              onClick={onDeclinePrompt}
              className="rounded-lg border border-ps-border px-3 py-1.5 text-[11px] font-semibold text-ps-text-sec transition-colors hover:bg-ps-surface"
            >
              {t("dash.live_mode_no_thanks")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
