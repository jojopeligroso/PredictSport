"use client";

import { useEffect, useState } from "react";
import type { LeaderboardTag } from "@/components/tournament/LeaderboardTagBadge";

/**
 * Fetch the active reputation tags for a competition and group them by user.
 *
 * Returns a map of userId -> tags (a user may hold one behavioural "title"
 * tag plus one live event-driven tag at the same time). Feature-flagged via
 * NEXT_PUBLIC_FEATURE_TAGS — returns an empty map when disabled.
 *
 * Shared by every leaderboard surface (overall standings, format/group view,
 * Rival Predictions) so the same tag pills appear everywhere.
 */
export function useCompetitionTags(
  competitionId: string,
): Map<string, LeaderboardTag[]> {
  const [tagsByUser, setTagsByUser] = useState<Map<string, LeaderboardTag[]>>(
    new Map(),
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEATURE_TAGS !== "true") return;
    let cancelled = false;

    fetch(`/api/tournament/competition-tags?competitionId=${competitionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, LeaderboardTag[]>();
        for (const tag of (data?.tags ?? []) as Array<
          LeaderboardTag & { userId: string }
        >) {
          const arr = map.get(tag.userId) ?? [];
          arr.push(tag);
          map.set(tag.userId, arr);
        }
        setTagsByUser(map);
      })
      .catch(() => {
        // Silently fail — tags are non-critical.
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  return tagsByUser;
}
