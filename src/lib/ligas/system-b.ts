/**
 * System B — the winter-league ("ligas invernales") baseball scoring system.
 *
 * Every game is scored on up to three stacked calls:
 *   1. Winner  — +4, and the GATE. A wrong winner scores 0 for the whole game,
 *                no matter what else was called.
 *   2. Margin  — a confidence-priced window over the after-9 run margin. The
 *                entrant selects a contiguous window of 1–4 buckets from
 *                {0, 1, 2, 3, 4, 5+}; the narrower the window, the larger the
 *                bonus (+6 / +4 / +3 / +2). The bonus lands whenever the actual
 *                after-9 margin falls anywhere inside the window.
 *   3. Exact   — the exact final score. A correct call DOUBLES the whole game
 *                total. Ceiling for a single game is therefore 20.
 *
 * The margin is measured at the end of the ninth inning by design: a game won
 * in extras is scored as a tie after nine (bucket 0), not as a one-run win.
 *
 * See PREDICT_Scoring_Design (System B) for the full rationale. This module is
 * pure — no framework imports — so it is shared by the picks UI (points
 * preview) and the result scorer (confirm-result) alike.
 */

/** Marker written to a winner EPT's config so the scorer switches to System B. */
export const SYSTEM_B_MARKER = "system_b" as const;

/** Winner call — the gate. */
export const WINNER_POINTS = 4;

/** Single-game ceiling: (winner 4 + tightest margin 6) × exact 2. */
export const MAX_GAME_POINTS = 20;

/**
 * Margin buckets, indexed 0..5. Index maps directly to the after-9 run margin,
 * except the open-ended top bucket which covers any win of five runs or more.
 *   0 → tied after 9 (heads to extra innings)
 *   1..4 → won by exactly that many runs
 *   5 → won by 5 or more
 */
export const BUCKET_COUNT = 6;
export const TOP_BUCKET = BUCKET_COUNT - 1; // index 5 == "5+"

/** Display labels for the six buckets. Numeric/locale-agnostic. */
export const BUCKET_LABELS: readonly string[] = ["0", "1", "2", "3", "4", "5+"];

/** A contiguous window of buckets, inclusive. width = hi - lo + 1 (1..4). */
export interface MarginWindow {
  lo: number;
  hi: number;
}

/** Windows of width 5 or 6 are not offered — too easily satisfied to mean anything. */
export const MIN_WINDOW_WIDTH = 1;
export const MAX_WINDOW_WIDTH = 4;

/**
 * The sensible default: the two-bucket window {1, 2}. Under a representative
 * MLB after-9 profile this maximises expected bonus for an entrant with no
 * particular read (~46% hit rate). Skill lies in departing from it.
 */
export const DEFAULT_WINDOW: MarginWindow = { lo: 1, hi: 2 };

/** Confidence pricing: narrower window → bigger bonus. Keyed by window width. */
const BONUS_BY_WIDTH: Record<number, number> = {
  1: 6,
  2: 4,
  3: 3,
  4: 2,
};

/** Width of a window (bucket count it spans). */
export function windowWidth(w: MarginWindow): number {
  return w.hi - w.lo + 1;
}

/** True when the window is a valid System B selection (contiguous, width 1..4, in range). */
export function isValidWindow(w: MarginWindow): boolean {
  if (!Number.isInteger(w.lo) || !Number.isInteger(w.hi)) return false;
  if (w.lo < 0 || w.hi > TOP_BUCKET) return false;
  if (w.lo > w.hi) return false;
  const width = windowWidth(w);
  return width >= MIN_WINDOW_WIDTH && width <= MAX_WINDOW_WIDTH;
}

/** Margin bonus a window pays if hit (0 for an invalid window). */
export function marginBonus(w: MarginWindow): number {
  if (!isValidWindow(w)) return 0;
  return BONUS_BY_WIDTH[windowWidth(w)] ?? 0;
}

/** Map an after-9 run margin (absolute value) to its bucket index. */
export function marginToBucket(afterNineMargin: number): number {
  const m = Math.abs(Math.trunc(afterNineMargin));
  if (m <= 0) return 0;
  if (m >= TOP_BUCKET) return TOP_BUCKET;
  return m;
}

/** True when the actual bucket falls inside (or on the edge of) the window. */
export function windowContains(w: MarginWindow, bucket: number): boolean {
  return bucket >= w.lo && bucket <= w.hi;
}

/**
 * The most a single game can score given the entrant's calls, assuming every
 * call lands. Drives the "up to N pts" preview in the picks UI.
 *   winner only            → 4
 *   winner + margin window → 4 + bonus
 *   + exact score          → ×2
 */
export function potentialPoints(opts: {
  hasWinner: boolean;
  window?: MarginWindow | null;
  hasExact: boolean;
}): number {
  if (!opts.hasWinner) return 0;
  let total = WINNER_POINTS;
  if (opts.window && isValidWindow(opts.window)) total += marginBonus(opts.window);
  if (opts.hasExact) total *= 2;
  return total;
}

// ---------------------------------------------------------------------------
// Result scoring
// ---------------------------------------------------------------------------

/** One entrant's three calls for a game. Any call may be absent. */
export interface SystemBPicks {
  /** The team the entrant backed to win. */
  winner?: string | null;
  /** Confidence margin window (bucket indices). */
  window?: MarginWindow | null;
  /** Exact final score call. */
  exact?: { home: number; away: number } | null;
}

/** The settled game result, as far as System B needs it. */
export interface SystemBResult {
  /** Winning team name (already mapped to a winner option), or "" if none. */
  winner: string;
  /** Run margin at the END OF THE NINTH (0 == tied after 9, went to extras). */
  afterNineMargin: number;
  /** Final home/away score, for exact-score checking. Optional. */
  finalHome?: number | null;
  finalAway?: number | null;
  /** Home/away team names aligned with finalHome/finalAway (for exact match). */
  homeTeam?: string | null;
  awayTeam?: string | null;
  /** No-result (rain/abandoned): the game voids — winner still counts, margin voids. */
  noResult?: boolean;
}

/** Per-call breakdown of a scored game — the three values sum to `total`. */
export interface SystemBBreakdown {
  winnerPoints: number;
  marginPoints: number;
  /** The doubling delta contributed by a correct exact score (0 otherwise). */
  exactPoints: number;
  total: number;
  winnerCorrect: boolean;
  marginCorrect: boolean;
  exactCorrect: boolean;
}

/**
 * Did the entrant's exact-score call match the final score? Handles the
 * home/away order possibly differing between the entrant's frame (built from
 * the winner options / event name) and the result's home/away frame.
 */
function exactMatches(picks: SystemBPicks, result: SystemBResult): boolean {
  if (!picks.exact) return false;
  if (result.finalHome == null || result.finalAway == null) return false;
  const ph = picks.exact.home;
  const pa = picks.exact.away;
  // Direct orientation.
  if (ph === result.finalHome && pa === result.finalAway) return true;
  // Swapped orientation — only accept when we can't tell teams apart by name.
  if (!result.homeTeam && !result.awayTeam) {
    if (ph === result.finalAway && pa === result.finalHome) return true;
  }
  return false;
}

/**
 * Score one entrant's game under System B, returning the per-call breakdown.
 *
 * The winner is the gate: a wrong (or missing) winner yields 0 for the game.
 * A no-result voids the margin (winner still counts) and disables the exact
 * multiplier. The `exactPoints` field carries the *doubling delta* (equal to
 * winner+margin) so that the three fields sum to the true game total — this is
 * what lets three independent prediction rows add up to the System B score.
 */
export function scoreSystemBGame(
  picks: SystemBPicks,
  result: SystemBResult,
): SystemBBreakdown {
  const empty: SystemBBreakdown = {
    winnerPoints: 0,
    marginPoints: 0,
    exactPoints: 0,
    total: 0,
    winnerCorrect: false,
    marginCorrect: false,
    exactCorrect: false,
  };

  const picked = (picks.winner ?? "").trim();
  const won = (result.winner ?? "").trim();
  const winnerCorrect = picked.length > 0 && picked === won;

  // Gate: wrong winner → nothing scores.
  if (!winnerCorrect) return empty;

  const winnerPoints = WINNER_POINTS;

  // Margin bonus — voided on a no-result.
  let marginPoints = 0;
  let marginCorrect = false;
  if (!result.noResult && picks.window && isValidWindow(picks.window)) {
    const bucket = marginToBucket(result.afterNineMargin);
    if (windowContains(picks.window, bucket)) {
      marginPoints = marginBonus(picks.window);
      marginCorrect = true;
    }
  }

  const base = winnerPoints + marginPoints;

  // Exact multiplier — doubling delta. Disabled on a no-result.
  const exactCorrect = !result.noResult && exactMatches(picks, result);
  const exactPoints = exactCorrect ? base : 0;

  return {
    winnerPoints,
    marginPoints,
    exactPoints,
    total: base + exactPoints,
    winnerCorrect,
    marginCorrect,
    exactCorrect,
  };
}

// ---------------------------------------------------------------------------
// Serialisation helpers (prediction_data <-> MarginWindow)
// ---------------------------------------------------------------------------

/**
 * Read a margin window from a stored prediction_data blob. Winter-league margin
 * predictions store `{ team, window: [lo, hi] }` (bucket indices). Falls back
 * to the legacy `{ range_low, range_high }` shape (raw run values) when no
 * bucket window is present.
 */
export function windowFromPredictionData(
  data: Record<string, unknown> | null | undefined,
): MarginWindow | null {
  if (!data) return null;
  const raw = data["window"];
  if (Array.isArray(raw) && raw.length === 2) {
    const lo = Number(raw[0]);
    const hi = Number(raw[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const w = { lo, hi };
      return isValidWindow(w) ? w : null;
    }
  }
  // Legacy range shape → buckets.
  if (data["range_low"] != null && data["range_high"] != null) {
    const w = {
      lo: marginToBucket(Number(data["range_low"])),
      hi: marginToBucket(Number(data["range_high"])),
    };
    return isValidWindow(w) ? w : null;
  }
  return null;
}

/** Serialise a margin window back into prediction_data (with team + legacy range). */
export function windowToPredictionData(
  team: string,
  w: MarginWindow,
): Record<string, unknown> {
  return {
    team,
    window: [w.lo, w.hi],
    // Legacy fields kept so any generic margin tooling still reads a range.
    range_low: w.lo,
    range_high: w.hi === TOP_BUCKET ? 99 : w.hi,
  };
}
