"use client";

import { useState, useEffect, useMemo } from "react";
import { useT } from "@/lib/i18n";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;
const REVEAL_OFFSET_MS = 5 * 60_000;

function computeRevealTime(event: WindowEvent): Date {
  if (event.pick_reveal_at) return new Date(event.pick_reveal_at);
  return new Date(new Date(event.lock_time).getTime() + REVEAL_OFFSET_MS);
}

function formatLockLocal(lockTime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(lockTime));
}

function formatRevealCountdown(revealTime: Date): string {
  const diff = revealTime.getTime() - Date.now();
  if (diff <= 0) return "";
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Finds events within 36h of lock_time where user has incomplete predictions
 * (missing winner OR missing exact_score).
 */
function getUrgentIncompleteEvents(
  events: WindowEvent[],
  predictions: Prediction[],
): WindowEvent[] {
  const now = Date.now();
  return events.filter((event) => {
    const lockMs = new Date(event.lock_time).getTime();
    const diff = lockMs - now;
    // Only events within 36h window and not yet locked
    if (diff <= 0 || diff >= THIRTY_SIX_HOURS) return false;

    const eventPreds = predictions.filter((p) => p.event_id === event.id);
    const hasWinner = eventPreds.some((p) => p.prediction_type === "winner");
    const hasScore = eventPreds.some(
      (p) => p.prediction_type === "exact_score",
    );
    return !(hasWinner && hasScore);
  });
}

/** Finds events that are locked but picks aren't revealed yet. */
function getRevealWindowEvents(events: WindowEvent[]): WindowEvent[] {
  const now = Date.now();
  return events.filter((event) => {
    if (event.result_confirmed) return false;
    const lockMs = new Date(event.lock_time).getTime();
    if (now < lockMs) return false; // not locked yet
    const revealMs = computeRevealTime(event).getTime();
    return now < revealMs; // in the reveal window
  });
}

function getDismissKey(eventIds: string[]): string {
  return `prediction-banner-dismissed-${eventIds.sort().join(",")}`;
}

interface PredictionBannerProps {
  events: WindowEvent[];
  predictions: Prediction[];
}

export function PredictionBanner({ events, predictions }: PredictionBannerProps) {
  const t = useT();
  const [dismissed, setDismissed] = useState(true); // Start dismissed to avoid flash
  const [, setTick] = useState(0); // Force re-render for live countdown

  const urgentEvents = useMemo(
    () => getUrgentIncompleteEvents(events, predictions),
    [events, predictions],
  );

  const revealWindowEvents = useMemo(
    () => getRevealWindowEvents(events),
    [events],
  );

  const dismissKey = useMemo(
    () => getDismissKey(urgentEvents.map((e) => e.id)),
    [urgentEvents],
  );

  // Check localStorage on mount / when urgent events change
  useEffect(() => {
    if (urgentEvents.length === 0) {
      setDismissed(true);
      return;
    }
    try {
      const stored = localStorage.getItem(dismissKey);
      setDismissed(stored === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey, urgentEvents.length]);

  // Tick every second while in reveal window for live countdown
  useEffect(() => {
    if (revealWindowEvents.length === 0) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [revealWindowEvents.length]);

  // ── Reveal window banner (takes priority when no urgent events) ────────
  if ((urgentEvents.length === 0 || dismissed) && revealWindowEvents.length > 0) {
    const earliest = revealWindowEvents.reduce((best, ev) => {
      const rt = computeRevealTime(ev);
      return rt < best ? rt : best;
    }, computeRevealTime(revealWindowEvents[0]));

    const countdown = formatRevealCountdown(earliest);
    if (!countdown) return null;

    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-ps-amber/10 px-3.5 py-2.5 text-xs font-semibold text-ps-amber">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
        <p>{t("rivals.picks_reveal_in", { time: countdown })}</p>
      </div>
    );
  }

  if (urgentEvents.length === 0 || dismissed) return null;

  // ── Pre-lock urgency banner (existing behavior) ────────────────────────
  const earliestLock = urgentEvents.reduce((earliest, event) => {
    const lockMs = new Date(event.lock_time).getTime();
    return lockMs < earliest ? lockMs : earliest;
  }, Infinity);

  const hoursUntil = (earliestLock - Date.now()) / (1000 * 60 * 60);
  const isVeryUrgent = hoursUntil <= 6;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={`mb-3 flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
        isVeryUrgent
          ? "bg-ps-red/15 text-ps-red"
          : "bg-ps-amber/15 text-ps-amber-deep"
      }`}
    >
      <p>
        <span className="mr-1">
          {urgentEvents.length === 1
            ? t("wc.banner_pick_locks", { count: 1 })
            : t("wc.banner_picks_lock", { count: urgentEvents.length })}
        </span>
        {formatLockLocal(new Date(earliestLock).toISOString())}
      </p>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-2 opacity-60 transition-opacity hover:opacity-100"
        aria-label={t("wc.banner_dismiss")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
