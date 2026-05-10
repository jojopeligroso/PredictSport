"use client";

// Usage:
// Place once in a layout or page that is only shown to authenticated users.
// <PushNotificationPrompt />
//
// The component mounts invisibly and either:
//   - Auto-subscribes silently if permission is already granted
//   - Shows a bottom-sheet prompt on first visit (once only)
//   - Does nothing if already prompted or permission denied

import { useEffect, useState } from "react";
import {
  isPushSupported,
  isPwaInstalled,
  registerAndSubscribe,
} from "@/lib/push/client";

const LS_PROMPTED = "ps-push-prompted";
const LS_SUBSCRIBED = "ps-push-subscribed";

type PromptState = "idle" | "visible" | "requesting" | "done";

export function PushNotificationPrompt() {
  const [state, setState] = useState<PromptState>("idle");

  useEffect(() => {
    if (!isPushSupported()) return;

    const alreadyPrompted = localStorage.getItem(LS_PROMPTED) === "true";
    const alreadySubscribed = localStorage.getItem(LS_SUBSCRIBED) === "true";

    if (alreadySubscribed) return;

    // If browser already granted permission (e.g. re-visit after clearing storage),
    // auto-subscribe silently without showing the prompt.
    if (Notification.permission === "granted") {
      localStorage.setItem(LS_PROMPTED, "true");
      const isPwa = isPwaInstalled();
      registerAndSubscribe(isPwa).then((ok) => {
        if (ok) localStorage.setItem(LS_SUBSCRIBED, "true");
      });
      return;
    }

    // Permission denied — don't ask again.
    if (Notification.permission === "denied") {
      localStorage.setItem(LS_PROMPTED, "true");
      return;
    }

    // First time: show the prompt.
    if (!alreadyPrompted) {
      // Small delay so it doesn't flash on initial render before hydration settles.
      const t = setTimeout(() => setState("visible"), 800);
      return () => clearTimeout(t);
    }
  }, []);

  async function handleEnable() {
    setState("requesting");
    const permission = await Notification.requestPermission();
    localStorage.setItem(LS_PROMPTED, "true");

    if (permission === "granted") {
      const isPwa = isPwaInstalled();
      const ok = await registerAndSubscribe(isPwa);
      if (ok) localStorage.setItem(LS_SUBSCRIBED, "true");
    }

    setState("done");
  }

  function handleDismiss() {
    localStorage.setItem(LS_PROMPTED, "true");
    setState("done");
  }

  if (state === "idle" || state === "done") return null;

  return (
    <>
      {/* Backdrop — tap outside to dismiss */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        className={[
          "fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px]",
          "px-4 pb-safe-4 pb-4",
          // Slide-up animation via Tailwind animate-in (available in tw v4) —
          // falls back gracefully if plugin absent.
          "animate-in slide-in-from-bottom-4 duration-300 ease-out",
        ].join(" ")}
      >
        <div className="rounded-xl border border-ps-border bg-ps-surface p-4 shadow-lg">
          <div className="mb-4">
            {/* Bell icon */}
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-ps-amber-soft"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-ps-amber-deep"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>

            <h2
              id="push-prompt-title"
              className="text-sm font-semibold text-ps-text"
            >
              Get notified when rounds lock and results drop?
            </h2>
            <p className="mt-1 text-xs text-ps-text-sec">
              We&apos;ll ping you before picks close so you never miss a round.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={state === "requesting"}
              className={[
                "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                "bg-ps-amber text-ps-bg",
                "hover:bg-ps-amber-deep",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {state === "requesting" ? "Enabling\u2026" : "Enable notifications"}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className={[
                "rounded-lg px-3 py-2.5 text-sm font-medium text-ps-text-sec transition-colors",
                "hover:bg-ps-chip hover:text-ps-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2",
              ].join(" ")}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
