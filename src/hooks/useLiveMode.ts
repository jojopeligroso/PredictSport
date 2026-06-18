"use client";

import { useCallback, useState } from "react";

/**
 * Live-mode preference + per-session toggle for the WC home dashboard.
 *
 * The toggle defaults ON every session and is intentionally NOT persisted —
 * turning it off this time does not carry over to the next visit. The only
 * thing recorded (in localStorage, per device) is an explicit "always keep
 * off" choice, set either via Profile settings or by accepting the prompt that
 * surfaces after three consecutive off-toggles.
 *
 * Mirrors the SSR-safe localStorage pattern used by ThemeProvider / FixturesTabs.
 */

const PREF_KEY = "ps-live-mode-pref"; // "always_off" | unset
const STREAK_KEY = "ps-live-off-streak"; // integer string — consecutive off-toggles
const DISMISS_KEY = "ps-live-prompt-dismissed"; // "1" once the prompt is declined
const STREAK_THRESHOLD = 3;

function readAlwaysOff(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === "always_off";
  } catch {
    return false;
  }
}

/**
 * Persisted "always keep Live mode off" preference. Used by Profile settings
 * and by the dashboard prompt. localStorage-only, per device — never touches
 * the server or notification_prefs.
 */
export function useLiveModePreference() {
  // Lazy initializer reads localStorage (guarded) so the Profile toggle renders
  // in the right state without a flash. Matches FixturesTabs precedent.
  const [alwaysOff, setAlwaysOffState] = useState<boolean>(readAlwaysOff);

  const setAlwaysOff = useCallback((v: boolean) => {
    try {
      if (v) {
        window.localStorage.setItem(PREF_KEY, "always_off");
      } else {
        window.localStorage.removeItem(PREF_KEY);
        // Re-arm the gentle nudge when the user opts back into live mode.
        window.localStorage.removeItem(DISMISS_KEY);
        window.localStorage.removeItem(STREAK_KEY);
      }
    } catch {
      /* localStorage unavailable — preference simply isn't recorded */
    }
    setAlwaysOffState(v);
  }, []);

  return { alwaysOff, setAlwaysOff };
}

export interface LiveModeToggleState {
  /** Effective: is the live treatment enabled right now? */
  liveEnabled: boolean;
  /** Flip the session toggle. */
  toggle: () => void;
  /** Whether the "always keep off?" prompt should be shown. */
  showPrompt: boolean;
  /** Accept always-off (persists the preference). */
  acceptAlwaysOff: () => void;
  /** Decline always-off (stops nagging on this device). */
  declinePrompt: () => void;
}

/**
 * Session toggle for live mode. Defaults ON each session (OFF if the user has
 * persisted "always off"); the per-session choice itself is never persisted.
 * After STREAK_THRESHOLD consecutive off-toggles (tracked in localStorage so it
 * spans sessions) it surfaces a prompt offering to make live mode always-off.
 *
 * @param liveEventExists whether a match is currently live (drives prompt cleanup).
 */
export function useLiveModeToggle(liveEventExists: boolean): LiveModeToggleState {
  // Default ON each session — unless the user has persisted "always off", in
  // which case it starts OFF. Either way the toggle is fully flippable for the
  // session; flipping it never changes the persisted preference.
  const [sessionLiveOn, setSessionLiveOn] = useState<boolean>(() => !readAlwaysOff());
  const [showPrompt, setShowPrompt] = useState(false);

  const liveEnabled = sessionLiveOn;

  const toggle = useCallback(() => {
    setSessionLiveOn((prev) => {
      const next = !prev;
      try {
        if (next) {
          // Turned back ON → reset the consecutive-off streak.
          window.localStorage.setItem(STREAK_KEY, "0");
        } else {
          // Turned OFF → bump the streak; prompt at the threshold.
          const streak =
            (parseInt(window.localStorage.getItem(STREAK_KEY) ?? "0", 10) || 0) + 1;
          window.localStorage.setItem(STREAK_KEY, String(streak));
          const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
          if (streak >= STREAK_THRESHOLD && !dismissed && !readAlwaysOff()) {
            setShowPrompt(true);
          }
        }
      } catch {
        /* localStorage unavailable — streak just isn't tracked */
      }
      return next;
    });
  }, []);

  const acceptAlwaysOff = useCallback(() => {
    try {
      window.localStorage.setItem(PREF_KEY, "always_off");
      window.localStorage.setItem(STREAK_KEY, "0");
    } catch {
      /* ignore */
    }
    setSessionLiveOn(false);
    setShowPrompt(false);
  }, []);

  const declinePrompt = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
      window.localStorage.setItem(STREAK_KEY, "0");
    } catch {
      /* ignore */
    }
    setShowPrompt(false);
  }, []);

  // Only surface the prompt while a match is actually live — keeps it from
  // lingering once the live window closes (no effect needed).
  return {
    liveEnabled,
    toggle,
    showPrompt: showPrompt && liveEventExists,
    acceptAlwaysOff,
    declinePrompt,
  };
}
