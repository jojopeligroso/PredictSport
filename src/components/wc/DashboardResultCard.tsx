"use client";

import { useT } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { ConfidenceMicroPill } from "@/components/ConfidencePills";
import type { ResultRow } from "@/app/wc/home/fetchDashboardData";

/* ── Movement arrows (SVG inline) ──────────────────────────────────────── */

function ArrowUp() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ps-green"
      aria-hidden="true"
    >
      <path d="M6 10V2M3 5l3-3 3 3" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ps-red"
      aria-hidden="true"
    >
      <path d="M6 2v8M3 7l3 3 3-3" />
    </svg>
  );
}

function NeutralDot() {
  return (
    <span
      className="inline-block h-[5px] w-[5px] rounded-full bg-ps-text-ter"
      aria-hidden="true"
    />
  );
}

/* ── Streak flame icon ─────────────────────────────────────────────────── */

function FlameIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 1c0 2-2.5 3-2.5 5.5a3.5 3.5 0 007 0C10.5 4 8 3 6 1z" />
    </svg>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */

export type MovementDirection = "up" | "down" | "neutral";

export interface DashboardResultCardProps {
  result: ResultRow;
  /** Position movement direction for this matchday. */
  movement: MovementDirection;
  /** Current winner-prediction streak length (0 = no streak shown). */
  streak: number;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function DashboardResultCard({
  result,
  movement,
  streak,
}: DashboardResultCardProps) {
  const t = useT();
  const {
    fixture,
    homeScore,
    awayScore,
    userWinnerPick,
    userScorePick,
    winnerCorrect,
    scoreCorrect,
    winnerPoints,
    scorePoints,
    userConfidence,
  } = result;

  const homeTri =
    fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTri =
    fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  const hasPrediction = userWinnerPick !== null;
  const bothCorrect = winnerCorrect === true && scoreCorrect === true;
  const winnerOnly = winnerCorrect === true && scoreCorrect !== true;
  const wrong = hasPrediction && winnerCorrect === false;

  const totalPoints = winnerPoints + scorePoints;
  const isJackpot = bothCorrect; // exact score = shimmer

  // Build points breakdown string: "(+3 W +7 S)"
  const breakdownParts: string[] = [];
  if (winnerPoints > 0)
    breakdownParts.push(t("dash.winner_points", { points: winnerPoints }));
  if (scorePoints > 0)
    breakdownParts.push(t("dash.score_points", { points: scorePoints }));
  const breakdownStr =
    breakdownParts.length > 0 ? `(${breakdownParts.join(" ")})` : "";

  // Dot color class — green (both correct), gold/amber (winner only), no dot for wrong (stripe instead), grey for no prediction
  let dotEl: React.ReactNode = null;
  if (!hasPrediction) {
    dotEl = (
      <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ps-text-ter" />
    );
  } else if (bothCorrect) {
    dotEl = (
      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-ps-green" />
    );
  } else if (winnerOnly) {
    dotEl = (
      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-ps-amber" />
    );
  }
  // wrong = no dot, red stripe on left instead

  return (
    <div
      className={[
        "relative py-3",
        wrong ? "border-l-[3px] border-l-ps-red pl-2.5 -ml-1" : "",
      ].join(" ")}
    >
      {/* ── Top row: movement + dot + teams + score + correctness badge ─── */}
      <div className="flex items-center gap-1.5">
        {/* Movement indicator (left side) */}
        <span className="flex w-4 shrink-0 items-center justify-center">
          {movement === "up" && <ArrowUp />}
          {movement === "down" && <ArrowDown />}
          {movement === "neutral" && <NeutralDot />}
        </span>

        {/* Correctness dot (only for non-wrong predictions) */}
        {dotEl && <span className="flex shrink-0">{dotEl}</span>}

        {/* Home team */}
        <CountryFlag name={fixture.home} size={22} shape="pill" />
        <span className="text-sm font-semibold text-ps-text">{homeTri}</span>

        {/* Score */}
        <span className="flex-1 text-center font-mono text-base font-bold tabular-nums text-ps-text">
          {homeScore} – {awayScore}
        </span>

        {/* Away team */}
        <span className="text-sm font-semibold text-ps-text">{awayTri}</span>
        <CountryFlag name={fixture.away} size={22} shape="pill" />

        {/* Correctness badge (top right) */}
        {hasPrediction && (
          <span
            className={[
              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold",
              winnerCorrect
                ? "bg-ps-green/15 text-ps-green"
                : "bg-ps-red/15 text-ps-red",
            ].join(" ")}
          >
            {winnerCorrect ? "\u2713" : "\u2715"}
          </span>
        )}
      </div>

      {/* ── Bottom row: prediction + streak + points ───────────────────── */}
      {hasPrediction ? (
        <div className="mt-1 flex items-center gap-2 pl-[22px]">
          <span className="text-[11px] text-ps-text-ter">
            {t("dash.you_label")}{" "}
            <span className="font-semibold text-ps-text-sec">
              {userScorePick
                ? `${userScorePick.home}\u2013${userScorePick.away}`
                : userWinnerPick}
            </span>
            {userConfidence != null && (
              <ConfidenceMicroPill level={userConfidence} />
            )}
          </span>

          {/* Streak badge (3+) */}
          {streak >= 3 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-ps-amber/12 px-1.5 py-0.5 text-[10px] font-bold text-ps-amber">
              <FlameIcon />
              {streak}
            </span>
          )}

          {/* Points badge */}
          {totalPoints > 0 ? (
            <span
              className={[
                "ml-auto flex items-baseline gap-1 font-mono tabular-nums",
                isJackpot
                  ? "ps-jackpot-shimmer rounded-md bg-ps-amber/12 px-1.5 py-0.5"
                  : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[13px] font-semibold",
                  isJackpot ? "text-ps-amber" : "text-ps-green",
                ].join(" ")}
              >
                +{totalPoints}
              </span>
              {breakdownStr && (
                <span className="text-[10px] font-medium text-ps-text-ter">
                  {breakdownStr}
                </span>
              )}
            </span>
          ) : (
            <span className="ml-auto font-mono text-[11px] tabular-nums text-ps-text-ter">
              +0
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 pl-[22px]">
          <span className="text-[11px] text-ps-text-ter">
            {t("dash.no_prediction")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Matchday summary helper ───────────────────────────────────────────── */

/** Compute summary stats from a list of visible result rows. */
export function computeMatchdaySummary(results: ResultRow[]): {
  correctCount: number;
  totalPredicted: number;
  totalPoints: number;
} {
  let correctCount = 0;
  let totalPredicted = 0;
  let totalPoints = 0;
  for (const r of results) {
    if (r.userWinnerPick !== null) {
      totalPredicted++;
      if (r.winnerCorrect) correctCount++;
      totalPoints += r.winnerPoints + r.scorePoints;
    }
  }
  return { correctCount, totalPredicted, totalPoints };
}

/**
 * Compute winner-prediction streak for the user from an ordered list of results.
 * Results should be in chronological order (oldest first).
 * Returns the length of the current streak (consecutive correct winner predictions
 * ending at the most recent result).
 */
export function computeWinnerStreak(results: ResultRow[]): number {
  // Walk from newest to oldest
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.userWinnerPick === null) continue; // skip unpredicted
    if (r.winnerCorrect) {
      streak++;
    } else {
      break; // streak broken
    }
  }
  return streak;
}

/**
 * Compute movement direction from total points in the matchday.
 * Simple heuristic: points > 0 = up, points === 0 with predictions = down, else neutral.
 */
export function computeMovement(result: ResultRow): MovementDirection {
  if (result.userWinnerPick === null) return "neutral";
  const total = result.winnerPoints + result.scorePoints;
  if (total > 0) return "up";
  return "down";
}
