"use client";

// Push notification prompt — opt-out design.
//
// Flow:
//   Step 1: "Enable notifications" bottom sheet. Accept = subscribe all.
//           Decline = must tap "No, I don't want notifications".
//   Step 2: (only on decline) Refine preferences with category pills.
//           If user said "no" → pills start EMPTY (all off).
//           User toggles ON what they want, or leaves all off.
//           "Save preferences" commits to DB + subscribes if any are on.
//
// Mounts from layout.tsx via PushPromptWrapper. Safe to always render.

import { useEffect, useState, useCallback } from "react";
import {
  isPushSupported,
  isPwaInstalled,
  registerAndSubscribe,
} from "@/lib/push/client";

const LS_PROMPTED = "ps-push-prompted";
const LS_SUBSCRIBED = "ps-push-subscribed";

type Step = "idle" | "ask" | "requesting" | "refine" | "saving" | "done";

interface CategoryDef {
  key: string;
  label: string;
  description: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "prediction_reminders",
    label: "Lock reminders",
    description: "Before events lock",
  },
  {
    key: "result_notifications",
    label: "Results",
    description: "When scores are confirmed",
  },
  {
    key: "leaderboard_updates",
    label: "Leaderboard",
    description: "Weekly standings updates",
  },
  {
    key: "chat_mentions",
    label: "Chat mentions",
    description: "When someone @mentions you",
  },
  {
    key: "chat_member_join",
    label: "New members",
    description: "When someone joins your group",
  },
];

async function savePrefsToServer(prefs: Record<string, boolean>) {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification_prefs: prefs,
        ...(timezone ? { timezone } : {}),
      }),
    });
  } catch {
    // Silent — prefs will use server defaults until next profile save
  }
}

export function PushNotificationPrompt() {
  const [step, setStep] = useState<Step>("idle");
  // Refine pills state: key → enabled
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isPushSupported()) return;

    const alreadyPrompted = localStorage.getItem(LS_PROMPTED) === "true";
    const alreadySubscribed = localStorage.getItem(LS_SUBSCRIBED) === "true";

    if (alreadySubscribed) return;

    // Browser already granted → auto-subscribe silently
    if (Notification.permission === "granted") {
      localStorage.setItem(LS_PROMPTED, "true");
      const isPwa = isPwaInstalled();
      registerAndSubscribe(isPwa).then((ok) => {
        if (ok) localStorage.setItem(LS_SUBSCRIBED, "true");
      });
      return;
    }

    // Permission denied by browser → can't ask again
    if (Notification.permission === "denied") {
      localStorage.setItem(LS_PROMPTED, "true");
      return;
    }

    // First time: show the prompt after a short delay
    if (!alreadyPrompted) {
      const t = setTimeout(() => setStep("ask"), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Accept: subscribe to everything ────────────────────────────
  const handleAccept = useCallback(async () => {
    setStep("requesting");
    const permission = await Notification.requestPermission();
    localStorage.setItem(LS_PROMPTED, "true");

    if (permission === "granted") {
      const isPwa = isPwaInstalled();
      const ok = await registerAndSubscribe(isPwa);
      if (ok) localStorage.setItem(LS_SUBSCRIBED, "true");

      // Save all-on prefs
      const allOn: Record<string, boolean> = {};
      for (const cat of CATEGORIES) allOn[cat.key] = true;
      await savePrefsToServer(allOn);
    }

    setStep("done");
  }, []);

  // ── Decline: go to refine step with all pills OFF ──────────────
  const handleDecline = useCallback(() => {
    // All off — user said they don't want notifications
    const allOff: Record<string, boolean> = {};
    for (const cat of CATEGORIES) allOff[cat.key] = false;
    setSelected(allOff);
    setStep("refine");
  }, []);

  // ── Toggle a category pill ─────────────────────────────────────
  const toggleCategory = useCallback((key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Save refined preferences ───────────────────────────────────
  const handleSavePrefs = useCallback(async () => {
    setStep("saving");
    localStorage.setItem(LS_PROMPTED, "true");

    const anyEnabled = Object.values(selected).some(Boolean);

    if (anyEnabled) {
      // Need browser permission to deliver the ones they kept
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const isPwa = isPwaInstalled();
        const ok = await registerAndSubscribe(isPwa);
        if (ok) localStorage.setItem(LS_SUBSCRIBED, "true");
      }
    }

    await savePrefsToServer(selected);
    setStep("done");
  }, [selected]);

  // ── Skip refine entirely (X button) ────────────────────────────
  const handleSkipRefine = useCallback(() => {
    localStorage.setItem(LS_PROMPTED, "true");
    // Save all-off prefs since they declined and skipped refine
    const allOff: Record<string, boolean> = {};
    for (const cat of CATEGORIES) allOff[cat.key] = false;
    savePrefsToServer(allOff);
    setStep("done");
  }, []);

  if (step === "idle" || step === "done") return null;

  const anySelected = Object.values(selected).some(Boolean);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-ps-ink/20" aria-hidden="true" />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px] px-4 pb-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="rounded-xl border border-ps-border bg-ps-surface shadow-lg overflow-hidden">
          {/* ── Step 1: Ask ─────────────────────────────────────── */}
          {(step === "ask" || step === "requesting") && (
            <div className="p-5">
              <div className="mb-4">
                {/* Bell icon */}
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ps-amber-soft"
                  aria-hidden="true"
                >
                  <svg
                    width="20"
                    height="20"
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
                  className="text-base font-semibold text-ps-text"
                >
                  Stay in the game
                </h2>
                <p className="mt-1 text-sm text-ps-text-sec">
                  Get notified before picks lock, when results drop, and when
                  your group is talking.
                </p>
              </div>

              {/* Primary CTA — full width, prominent */}
              <button
                type="button"
                onClick={handleAccept}
                disabled={step === "requesting"}
                className="w-full rounded-lg px-3 py-3 text-sm font-semibold transition-colors bg-ps-amber text-ps-bg hover:bg-ps-amber-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {step === "requesting" ? "Enabling..." : "Enable notifications"}
              </button>

              {/* Decline — subtle, requires deliberate action */}
              <button
                type="button"
                onClick={handleDecline}
                disabled={step === "requesting"}
                className="mt-2 w-full rounded-lg px-3 py-2.5 text-xs font-medium text-ps-text-ter transition-colors hover:text-ps-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2"
              >
                No, I don&apos;t want notifications
              </button>
            </div>
          )}

          {/* ── Step 2: Refine preferences ─────────────────────── */}
          {(step === "refine" || step === "saving") && (
            <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="push-prompt-title"
                    className="text-base font-semibold text-ps-text"
                  >
                    Refine your preferences
                  </h2>
                  <p className="mt-1 text-sm text-ps-text-sec">
                    Select the notifications you actually want.
                  </p>
                </div>

                {/* Close / skip */}
                <button
                  type="button"
                  onClick={handleSkipRefine}
                  aria-label="Skip and disable all notifications"
                  className="shrink-0 rounded-md p-1.5 text-ps-text-ter transition-colors hover:bg-ps-chip hover:text-ps-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber"
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

              {/* Category pills */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Notification categories">
                {CATEGORIES.map((cat) => {
                  const on = selected[cat.key] ?? false;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleCategory(cat.key)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.96] ${
                        on
                          ? "bg-ps-amber-deep text-[#1a1208] ring-1 ring-ps-amber-deep"
                          : "bg-ps-chip text-ps-text-ter ring-1 ring-ps-border hover:text-ps-text-sec hover:ring-ps-text-ter"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Descriptions — show for selected pills */}
              {anySelected && (
                <div className="mt-3 space-y-1">
                  {CATEGORIES.filter((cat) => selected[cat.key]).map((cat) => (
                    <p key={cat.key} className="text-xs text-ps-text-ter">
                      <span className="font-medium text-ps-text-sec">
                        {cat.label}
                      </span>{" "}
                      &mdash; {cat.description}
                    </p>
                  ))}
                </div>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={step === "saving"}
                className={`mt-4 w-full rounded-lg px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                  anySelected
                    ? "bg-ps-amber text-ps-bg hover:bg-ps-amber-deep"
                    : "bg-ps-chip text-ps-text-sec hover:bg-ps-border"
                }`}
              >
                {step === "saving"
                  ? "Saving..."
                  : anySelected
                    ? `Enable ${selectedCount} notification${selectedCount !== 1 ? "s" : ""}`
                    : "Keep all off"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
