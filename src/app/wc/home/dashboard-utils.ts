import { getTimingForSport } from "@/lib/sports/timing";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

export type PickStatus = "complete" | "urgent" | "unpicked" | "in_progress";

/** Max live window per sport: expected match duration + 1h buffer for result confirmation. */
export function getLiveWindowMs(sport: string): number {
  const { checkAfterHours } = getTimingForSport(sport);
  return (checkAfterHours + 1) * 60 * 60 * 1000;
}

/** Is this event currently live: started, unresolved, and within its sport's live window? */
export function isEventLive(event: WindowEvent): boolean {
  const startMs = new Date(event.start_time).getTime();
  const nowMs = Date.now();
  return startMs <= nowMs && !event.result_confirmed && nowMs < startMs + getLiveWindowMs(event.sport);
}

export function getPickStatus(
  event: WindowEvent,
  predictions: Prediction[],
  liveEnabled: boolean,
): PickStatus {
  // In-progress (LIVE): match has started but not yet resulted.
  // Capped at sport-specific duration (checkAfterHours + 1h buffer) so the
  // dashboard reverts to idle even if auto-resolve fails completely.
  // Soccer: 3h, rugby: 3.5h, golf: 9h, etc.
  // When the user has turned Live mode off, skip this branch so the event
  // falls through to the locked/"complete" treatment below (the prediction is
  // already locked because the match is past lock_time — no regression).
  const lockMs = new Date(event.lock_time).getTime();
  const startMs = new Date(event.start_time).getTime();
  const nowMs = Date.now();
  const liveWindow = getLiveWindowMs(event.sport);
  if (liveEnabled && startMs <= nowMs && !event.result_confirmed && nowMs < startMs + liveWindow)
    return "in_progress";

  // Locked: past lock_time but match hasn't started (or live window expired).
  // No further action possible — treat as complete regardless of pick state.
  if (lockMs <= nowMs && !event.result_confirmed) return "complete";

  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  // "Complete" = has both winner and exact_score predictions
  const hasWinner = eventPreds.some((p) => p.prediction_type === "winner");
  const hasScore = eventPreds.some((p) => p.prediction_type === "exact_score");
  if (hasWinner && hasScore) return "complete";

  // Urgent = < 36h to lock
  if (lockMs - nowMs < 36 * 60 * 60 * 1000 && lockMs > nowMs) return "urgent";

  return "unpicked";
}

/** Check if user has both winner + exact_score predictions for an event. */
export function hasCompletePick(event: WindowEvent, predictions: Prediction[]): boolean {
  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  return (
    eventPreds.some((p) => p.prediction_type === "winner") &&
    eventPreds.some((p) => p.prediction_type === "exact_score")
  );
}
