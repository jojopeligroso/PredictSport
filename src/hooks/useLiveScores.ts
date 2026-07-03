"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveScorePayload } from "@/app/api/events/live-scores/route";

export type { LiveScorePayload };

const POLL_MS = 60_000;

/**
 * Polls /api/events/live-scores for the given event ids every 60s, paused
 * while the tab is hidden and refetched immediately on return (same
 * visibility pattern as the ClassificationTabs provisional poll).
 *
 * Returns a map of eventId → live payload. Events without a live score (not
 * started, or already confirmed) are simply absent from the map.
 */
export function useLiveScores(eventIds: string[]): Record<string, LiveScorePayload> {
  const [scores, setScores] = useState<Record<string, LiveScorePayload>>({});
  const idsKey = eventIds.slice().sort().join(",");

  const fetchScores = useCallback(async (ids: string) => {
    try {
      const res = await fetch(
        `/api/events/live-scores?ids=${encodeURIComponent(ids)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        scores?: Record<string, LiveScorePayload>;
      };
      if (data?.scores) setScores(data.scores);
    } catch {
      /* transient network error — keep last known scores */
    }
  }, []);

  useEffect(() => {
    if (!idsKey) return;

    void fetchScores(idsKey);

    const interval = setInterval(() => {
      if (!document.hidden) void fetchScores(idsKey);
    }, POLL_MS);

    const onVisibility = () => {
      if (!document.hidden) void fetchScores(idsKey);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [idsKey, fetchScores]);

  // No ids → empty map (stale state may linger but is never exposed).
  return idsKey ? scores : EMPTY_SCORES;
}

const EMPTY_SCORES: Record<string, LiveScorePayload> = {};
