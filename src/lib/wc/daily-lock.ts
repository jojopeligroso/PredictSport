/**
 * Daily prediction-window lock-time utilities.
 *
 * The rule: each UTC calendar day locks 10 minutes before the earliest
 * kickoff on that day. All events on the same UTC date share one lock time.
 *
 * The single source of truth is `events.lock_time` in the database.
 * Frontend countdowns and backend validation both read the same column.
 * No client-side lock calculation — the client displays, the server enforces.
 */

/** Minutes before the earliest kickoff that a daily window locks. */
export const DAILY_LOCK_OFFSET_MINUTES = 10;

/**
 * Given a list of events with start_time and lock_time, group by UTC date
 * and return the daily lock time for each date.
 *
 * Used by the UI to show one countdown per day rather than per event.
 */
export function getDailyLockTimes(
  events: { id: string; start_time: string; lock_time: string }[]
): Map<string, string> {
  const byDate = new Map<string, string[]>();
  for (const e of events) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = byDate.get(iso) ?? [];
    list.push(e.lock_time);
    byDate.set(iso, list);
  }

  const result = new Map<string, string>();
  for (const [iso, lockTimes] of byDate) {
    // All events on the same day should already share the same lock_time
    // (set by the seed/migration). Take the earliest as a safety net.
    lockTimes.sort();
    result.set(iso, lockTimes[0]);
  }
  return result;
}

/**
 * Compute what the lock_time SHOULD be for events on a given UTC date,
 * based on the earliest kickoff on that date.
 *
 * Used by the seed script and migrations to set event lock_times.
 */
export function computeDailyLockTime(
  eventsOnSameDay: { start_time: string }[]
): Date {
  if (eventsOnSameDay.length === 0) {
    throw new Error("Cannot compute daily lock time for zero events");
  }
  const earliest = eventsOnSameDay
    .map((e) => new Date(e.start_time).getTime())
    .reduce((a, b) => Math.min(a, b));
  return new Date(earliest - DAILY_LOCK_OFFSET_MINUTES * 60_000);
}

/** ISO date string from a Date in UTC. */
export function utcDateIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DayPredictionStatus =
  | "complete"       // All fixtures have winner + exact_score
  | "partial"        // Some outcomes saved but missing exact scores
  | "urgent"         // Incomplete and < 24h until lock
  | "upcoming";      // Incomplete and >= 24h until lock

/**
 * Determine the prediction status for a daily window.
 *
 * Shared source of truth for both date-pill and section-heading display.
 */
export function computeDayStatus(opts: {
  totalEvents: number;
  fullyComplete: number;
  hasAnyOutcome: boolean;
  lockTime: string;
  now: Date;
}): DayPredictionStatus {
  if (opts.totalEvents > 0 && opts.fullyComplete === opts.totalEvents) {
    return "complete";
  }
  const lockMs = new Date(opts.lockTime).getTime();
  const diffMs = lockMs - opts.now.getTime();
  if (diffMs <= 0) {
    // Already locked — show whatever state they're in
    return opts.hasAnyOutcome ? "partial" : "upcoming";
  }
  const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;
  if (diffMs < THIRTY_SIX_HOURS && opts.fullyComplete < opts.totalEvents) {
    return "urgent";
  }
  if (opts.hasAnyOutcome && opts.fullyComplete < opts.totalEvents) {
    return "partial";
  }
  return "upcoming";
}

/**
 * Format a lock-time countdown string. Returns null if already locked.
 * Max precision: days + hours when > 1 day, hours + minutes otherwise.
 */
export function formatLockCountdown(lockTime: string, now: Date): string | null {
  const diff = new Date(lockTime).getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
