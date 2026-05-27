/**
 * Soft join cutoff for the World Cup 2026 prediction game.
 *
 * SPEC.md §16.10 (as of ADR 0014) — the parent WC prediction game remains
 * joinable until 72h after the first MD1 kickoff. Late joiners can still
 * submit picks for matches that haven't yet locked, but auto-forfeit any
 * already-locked match.
 *
 * The cutoff lives on `competitions.joins_locked_at` (nullable timestamptz).
 * The daily results cron flips this column to now() once we pass
 * WC_JOINS_CLOSE_AT. Super Admin can override the value directly in Supabase
 * for early/late cutoff handling without a deploy.
 *
 * /wc/join reads both the column and this constant on every visit and gates
 * new enrollments accordingly. Existing members always pass through.
 */

/** First MD1 kickoff: Mexico v South Africa, Mexico City (kickoff in UTC). */
export const WC_FIRST_KICKOFF_UTC = "2026-06-11T19:00:00Z";

/** Soft join cutoff: first kickoff + 72h. End of day Sun 14 Jun 2026 UTC. */
export const WC_JOINS_CLOSE_AT = "2026-06-14T19:00:00Z";

/** The ISO date (YYYY-MM-DD) immediately before the cutoff. Sat 13 Jun 2026. */
export function dayBeforeCloseUtcDate(): string {
  // One day earlier than the close date. Hard-coded UTC date arithmetic to keep
  // the value stable across timezones — the calendar pills are UTC-anchored to
  // match seeded fixture dates.
  return "2026-06-13";
}

export type JoinCutoffWarningState = "none" | "day-before" | "day-of" | "closed";

/**
 * Returns which warning UX should render right now.
 *
 *   none       — > 1 day before close. Banner hidden, "!" badge hidden.
 *   day-before — within the calendar day immediately before close. Banner + "!".
 *   day-of     — within the calendar day of close itself. Banner "last day".
 *   closed     — past the cutoff. Banner "joins closed".
 *
 * All comparisons happen in UTC against the WC_JOINS_CLOSE_AT instant. The
 * "day-before"/"day-of" buckets are derived by walking back/forth one UTC day
 * from the close instant, then comparing `now`'s UTC date to those buckets.
 */
export function joinCutoffWarningState(now: Date): JoinCutoffWarningState {
  const closeMs = new Date(WC_JOINS_CLOSE_AT).getTime();
  const nowMs = now.getTime();

  if (nowMs >= closeMs) return "closed";

  const nowIso = utcDateIso(now);
  const closeIso = utcDateIso(new Date(closeMs));
  const dayBeforeIso = dayBeforeCloseUtcDate();

  if (nowIso === dayBeforeIso) return "day-before";
  if (nowIso === closeIso) return "day-of";
  return "none";
}

/** Has the cutoff already passed (in UTC, against the wall-clock instant)? */
export function isJoinsClosed(now: Date): boolean {
  return now.getTime() >= new Date(WC_JOINS_CLOSE_AT).getTime();
}

function utcDateIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
