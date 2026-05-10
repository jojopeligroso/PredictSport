"use client";

// Usage:
// Render after a successful prediction submission in EventDetail.
// The component handles its own visibility conditions — safe to always render.
//
// <PwaInstallGuide />
//
// Shows only when:
//   - User is on iOS Safari (not already in standalone/PWA mode)
//   - User has not dismissed this guide before
//
// Stores dismissal in localStorage key "ps-pwa-guide-dismissed".

import { useState } from "react";

const LS_DISMISSED = "ps-pwa-guide-dismissed";

function shouldShow(): boolean {
  // Only runs client-side (lazy useState initializer is not called during SSR).
  if (typeof window === "undefined") return false;

  if (localStorage.getItem(LS_DISMISSED) === "true") return false;

  const isIos = /(iPhone|iPad|iPod)/.test(navigator.userAgent);
  const isPwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return isIos && !isPwa;
}

export function PwaInstallGuide() {
  // Lazy initializer: runs once on first render, client-side only.
  const [visible, setVisible] = useState<boolean>(() => shouldShow());

  function handleDismiss() {
    localStorage.setItem(LS_DISMISSED, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Tap-outside dismissal */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-guide-title"
        className={[
          "fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px]",
          "px-4 pb-safe-4 pb-4",
          "animate-in slide-in-from-bottom-4 duration-300 ease-out",
        ].join(" ")}
      >
        <div className="rounded-xl border border-ps-border bg-ps-surface p-4 shadow-lg">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div
                className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-ps-amber-soft"
                aria-hidden="true"
              >
                {/* Home/phone icon */}
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
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>

              <h2
                id="pwa-guide-title"
                className="text-sm font-semibold text-ps-text"
              >
                Add to Home Screen for lock-screen notifications
              </h2>
              <p className="mt-0.5 text-xs text-ps-text-sec">
                Takes 10 seconds. Works like a native app.
              </p>
            </div>

            {/* X close button */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install guide"
              className={[
                "shrink-0 rounded-md p-1 text-ps-text-ter transition-colors",
                "hover:bg-ps-chip hover:text-ps-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber",
              ].join(" ")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Steps */}
          <ol className="mb-4 space-y-2.5" aria-label="Steps to install">
            <Step number={1}>
              Tap the{" "}
              <strong className="font-semibold text-ps-text">
                Share button
              </strong>{" "}
              <ShareIcon /> at the bottom of Safari
            </Step>
            <Step number={2}>
              Scroll down in the share sheet
            </Step>
            <Step number={3}>
              Tap{" "}
              <strong className="font-semibold text-ps-text">
                &ldquo;Add to Home Screen&rdquo;
              </strong>
            </Step>
          </ol>

          {/* CTA */}
          <button
            type="button"
            onClick={handleDismiss}
            className={[
              "w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              "bg-ps-amber text-ps-bg",
              "hover:bg-ps-amber-deep",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2",
            ].join(" ")}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ps-amber-soft text-xs font-bold text-ps-amber-deep"
        aria-hidden="true"
      >
        {number}
      </span>
      <span className="text-xs leading-5 text-ps-text-sec">{children}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-[-1px] text-ps-amber-deep"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
