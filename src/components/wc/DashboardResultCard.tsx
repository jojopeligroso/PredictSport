"use client";

import { useT } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { ResultRow } from "@/app/wc/home/fetchDashboardData";

/* ── Movement arrows (SVG inline) ──────────────────────────────────────── */

function ArrowUp() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
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
      width="18"
      height="18"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ps-red"
      aria-hidden="true"
    >
      <path d="M6 2v8M3 7l3 3 3-3" />
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
    h2hPoints,
    penaltyHome,
    penaltyAway,
  } = result;

  const homeTri =
    fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTri =
    fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  const hasPrediction = userWinnerPick !== null;
  const bothCorrect = winnerCorrect === true && scoreCorrect === true;
  const wrong = hasPrediction && winnerCorrect === false;

  const totalPoints = winnerPoints + scorePoints + h2hPoints;
  const isJackpot = bothCorrect; // exact score = shimmer

  // Prediction display: "Team" or "Team H–A"
  const predDisplay = userScorePick
    ? `${userWinnerPick} ${userScorePick.home}\u2013${userScorePick.away}`
    : userWinnerPick;

  const isCorrect = winnerCorrect === true;

  return (
    <div
      className={[
        "relative py-3.5",
        wrong ? "border-l-[3px] border-l-ps-red pl-2.5 -ml-[3px]" : "",
      ].join(" ")}
    >
      {/* ── Compact scoreboard row ── */}
      <div
        className={[
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5",
          hasPrediction
            ? isCorrect
              ? "bg-ps-green/7 shadow-[inset_0_0_0_1px_rgba(10,168,109,0.25)]"
              : "bg-ps-red/7 shadow-[inset_0_0_0_1px_rgba(226,61,79,0.25)]"
            : "bg-ps-text/4 shadow-[inset_0_0_0_1px_rgba(25,21,18,0.10)]",
        ].join(" ")}
      >
        <CountryFlag name={fixture.home} size={22} shape="pill" />
        <span className="text-[11px] font-bold text-ps-text shrink-0">{homeTri}</span>
        <span className="flex-1 text-center font-mono font-extrabold tabular-nums text-ps-text">
          <span className="text-[15px]">{homeScore} – {awayScore}</span>
          {penaltyHome !== null && penaltyAway !== null && (
            <span className="block text-[9px] font-bold text-ps-text-ter tracking-wide">
              ({penaltyHome}–{penaltyAway} pens)
            </span>
          )}
        </span>
        <span className="text-[11px] font-bold text-ps-text shrink-0">{awayTri}</span>
        <CountryFlag name={fixture.away} size={22} shape="pill" />
        <span className="rounded-full bg-ps-green px-[5px] py-[2px] text-[7px] font-bold uppercase tracking-[0.5px] text-white shrink-0">
          {penaltyHome !== null ? "Pens" : "FT"}
        </span>
      </div>

      {/* ── Verdict row: arrow block | prediction | points block ── */}
      {hasPrediction ? (
        <div className="mt-2 flex overflow-hidden rounded-lg min-h-[40px]">
          {/* Arrow block */}
          <div
            className={[
              "flex w-10 shrink-0 items-center justify-center bg-ps-text/5",
              isCorrect
                ? "border-r-[2.5px] border-r-ps-green"
                : "border-r-[2.5px] border-r-ps-red",
            ].join(" ")}
          >
            {movement === "up" && <ArrowUp />}
            {movement === "down" && <ArrowDown />}
            {movement === "neutral" && (
              <span className="text-[16px] font-extrabold text-ps-text-ter" aria-hidden="true">—</span>
            )}
          </div>

          {/* Center — prediction text */}
          <div className="flex flex-1 items-center bg-ps-text/4 px-3 py-2">
            <span className="text-[12px] text-ps-text-ter">
              {t("dash.prediction_label")}{" "}
              <span className="text-[13px] font-bold text-ps-text">{predDisplay}</span>
            </span>
          </div>

          {/* Points block — muted color fill */}
          <div
            className={[
              "flex w-14 shrink-0 items-center justify-center",
              isCorrect ? "bg-ps-green/12" : "bg-ps-red/12",
            ].join(" ")}
          >
            <span
              className={[
                "font-mono text-[18px] font-extrabold tabular-nums",
                isJackpot ? "ps-jackpot-shimmer text-ps-amber" : isCorrect ? "text-ps-green" : "text-ps-red",
              ].join(" ")}
            >
              +{totalPoints}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-ps-text/4 px-3 py-2">
          <span className="text-[12px] text-ps-text-ter">
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
      totalPoints += r.winnerPoints + r.scorePoints + r.h2hPoints;
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
