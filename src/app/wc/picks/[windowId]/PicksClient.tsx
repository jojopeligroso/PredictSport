"use client";

import { useState } from "react";
import { MatchdayCompleteCelebration } from "@/components/tournament/MatchdayCompleteCelebration";
import { WindowPickList, type WindowEvent } from "./WindowPickList";
import type { Prediction } from "@/types/database";

/**
 * Client wrapper around <WindowPickList> that owns the celebration overlay
 * state. Lives next to the page (a Server Component) so the server can fetch
 * predictions/events/prev-next windows and just hand them down.
 *
 * Celebration fires the first time `onWindowComplete` is raised from
 * WindowPickList. The page passes `windowSessionKey` so we only celebrate once
 * per matchday completion per session — revisiting a completed matchday
 * doesn't re-trigger.
 */
interface PicksClientProps {
  competitionId: string;
  events: WindowEvent[];
  predictions: Prediction[];
  windowLocked: boolean;
  matchdayName: string;
  nextWindowId: string | null;
  nextWindowName: string | null;
}

export function PicksClient({
  competitionId,
  events,
  predictions,
  windowLocked,
  matchdayName,
  nextWindowId,
  nextWindowName,
}: PicksClientProps) {
  const [celebrating, setCelebrating] = useState(false);

  return (
    <>
      <WindowPickList
        competitionId={competitionId}
        events={events}
        predictions={predictions}
        windowLocked={windowLocked}
        onWindowComplete={() => setCelebrating(true)}
      />
      <MatchdayCompleteCelebration
        open={celebrating}
        matchdayName={matchdayName}
        nextWindowId={nextWindowId}
        nextWindowName={nextWindowName}
        onClose={() => setCelebrating(false)}
      />
    </>
  );
}
