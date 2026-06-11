"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";

// ── Types ───────────────────────────────────────────────────────────────────

interface RevealedFixture {
  eventId: string;
  name: string;
  lockTime: string;
  pickRevealAt: string | null;
  startTime: string;
  resultConfirmed: boolean;
  resultData: Record<string, unknown> | null;
  externalEventId: string | null;
  sport: string;
  roundName: string | null;
}

interface RivalPrediction {
  userId: string;
  displayName: string;
  winner: string | null;
  exactScore: { home: number; away: number } | null;
  winnerCorrect: boolean | null;
  scoreCorrect: boolean | null;
  totalPoints: number;
  isGroupMember: boolean;
  isSelf: boolean;
}

interface EventMeta {
  eventId: string;
  name: string;
  lockTime: string;
  pickRevealAt: string | null;
  startTime: string;
  resultConfirmed: boolean;
  resultData: Record<string, unknown> | null;
  externalEventId: string | null;
  sport: string;
  roundName: string | null;
}

interface Props {
  competitionId: string;
  currentUserId: string;
  initialEventId?: string | null;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function RivalPredictionsTab({
  competitionId,
  currentUserId,
  initialEventId,
}: Props) {
  const t = useT();
  const { locale } = useLocale();

  const [fixtures, setFixtures] = useState<RevealedFixture[]>([]);
  const [fixtureIdx, setFixtureIdx] = useState(0);
  const [predictions, setPredictions] = useState<RivalPrediction[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(false);
  const [eventMeta, setEventMeta] = useState<EventMeta | null>(null);

  // Fetch revealed fixtures
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/tournament/rival-predictions?competitionId=${competitionId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const fx: RevealedFixture[] = data?.fixtures ?? [];
        setFixtures(fx);

        // Set initial fixture index
        if (initialEventId) {
          const idx = fx.findIndex((f) => f.eventId === initialEventId);
          if (idx >= 0) setFixtureIdx(idx);
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId, initialEventId]);

  // Fetch predictions for the selected fixture
  const selectedFixture = fixtures[fixtureIdx] ?? null;

  useEffect(() => {
    if (!selectedFixture) return;
    let cancelled = false;
    setPredLoading(true);

    fetch(
      `/api/tournament/rival-predictions?competitionId=${competitionId}&eventId=${selectedFixture.eventId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPredictions(data?.predictions ?? []);
        setTotalMembers(data?.totalMembers ?? 0);
        setEventMeta(data?.event ?? null);
        setPredLoading(false);
      })
      .catch(() => {
        if (!cancelled) setPredLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId, selectedFixture?.eventId]);

  const goPrev = useCallback(() => {
    setFixtureIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setFixtureIdx((i) => Math.min(fixtures.length - 1, i + 1));
  }, [fixtures.length]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-4 flex justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ps-text-ter border-t-ps-text" />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (fixtures.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center">
        <p className="text-sm text-ps-text-sec">{t("rivals.no_revealed")}</p>
      </div>
    );
  }

  // Result data for the selected fixture
  const resultData = eventMeta?.resultData ?? selectedFixture?.resultData;
  const resultConfirmed = eventMeta?.resultConfirmed ?? selectedFixture?.resultConfirmed ?? false;
  const homeScore = resultData ? Number((resultData as Record<string, unknown>).home_score ?? (resultData as Record<string, unknown>).homeScore) : null;
  const awayScore = resultData ? Number((resultData as Record<string, unknown>).away_score ?? (resultData as Record<string, unknown>).awayScore) : null;
  const hasResult = resultConfirmed && homeScore != null && !isNaN(homeScore);

  const intlLocale = locale === "es" ? "es-MX" : "en-GB";
  const fixtureDate = selectedFixture
    ? new Date(selectedFixture.startTime).toLocaleDateString(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const fixtureTime = selectedFixture
    ? new Date(selectedFixture.startTime).toLocaleTimeString(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  return (
    <div className="mt-4">
      {/* ── Fixture browser ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-ps-border bg-white shadow-sm dark:bg-ps-surface">
        <div className="px-4 pb-3 pt-3.5">
          {/* Round label */}
          {selectedFixture?.roundName && (
            <p className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.10em] text-ps-text-ter">
              {selectedFixture.roundName}
            </p>
          )}

          {/* Nav: ‹ Fixture name › */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={fixtureIdx === 0}
              aria-label="Previous fixture"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-ps-border bg-ps-bg text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-30"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 text-center">
              <p className="text-[15px] font-bold text-ps-text">
                {selectedFixture?.name}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-ps-text-sec">
                {fixtureDate} · {fixtureTime}
              </p>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={fixtureIdx === fixtures.length - 1}
              aria-label="Next fixture"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-ps-border bg-ps-bg text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-30"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>

          {/* Status: revealed or final */}
          <div className="mt-2">
            {hasResult ? (
              <div className="flex items-center justify-center gap-1.5 rounded-md bg-ps-green/10 px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ps-green" />
                <span className="text-[11px] font-semibold text-ps-green">
                  {t("rivals.final")}
                </span>
                <span className="text-[11px] text-ps-text-ter">·</span>
                <span className="font-mono text-[11px] font-semibold text-ps-green">
                  {homeScore} – {awayScore}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-md bg-ps-amber/10 px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ps-amber" />
                <EyeIcon />
                <span className="text-[11px] font-semibold text-ps-amber">
                  {t("rivals.predictions_revealed")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Prediction list ──────────────────────────────────────────── */}
      <div className="mt-1 overflow-hidden rounded-xl border border-ps-border bg-white shadow-sm dark:bg-ps-surface">
        {/* List header */}
        <div className="flex items-center justify-between border-b border-ps-border/50 px-4 py-2.5">
          <span className="text-xs font-medium text-ps-text-sec">
            {t("rivals.predictions_count", { count: totalMembers })}
          </span>
          <span className="text-[11px] font-semibold text-ps-amber">
            {t("rivals.sort_points")}
          </span>
        </div>

        {/* Prediction rows */}
        {predLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ps-text-ter border-t-ps-text" />
          </div>
        ) : (
          <div>
            {predictions.map((row, i) => (
              <PredictionRow
                key={row.userId}
                row={row}
                rank={i + 1}
                hasResult={hasResult}
              />
            ))}

            {/* Scroll hint when list is long */}
            {predictions.length > 8 && (
              <div className="border-t border-ps-border/50 px-4 py-2.5 text-center text-[11px] font-medium text-ps-text-ter">
                {t("rivals.scroll_more", {
                  count: predictions.length - 8,
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Prediction Row ──────────────────────────────────────────────────────────

function PredictionRow({
  row,
  rank,
  hasResult,
}: {
  row: RivalPrediction;
  rank: number;
  hasResult: boolean;
}) {
  const t = useT();
  const noPick = row.winner === null;
  const isPending = !noPick && row.winnerCorrect === null;
  const isExact = row.scoreCorrect === true;
  const isCorrect = !isExact && row.winnerCorrect === true;
  const isWrong = row.winnerCorrect === false;

  // Row variant classes
  let rowClass = "border-l-transparent bg-transparent"; // pending / default
  if (row.isSelf) {
    rowClass = "border-l-ps-amber bg-[#fffbeb]";
  } else if (isExact) {
    rowClass = "border-l-[#00c87a] bg-[rgba(0,200,122,0.06)]";
  } else if (isCorrect) {
    rowClass = "border-l-ps-green bg-[#f0fdf8]";
  } else if (isWrong) {
    rowClass = "border-l-ps-red bg-[#fff5f6]";
  } else if (noPick) {
    rowClass = "border-l-ps-border bg-transparent";
  }

  // Display value:
  // - Exact score correct → show score in mono (e.g., "2–1")
  // - Winner correct → show team name
  // - Wrong → show result type they picked (team name / draw), NOT the score
  // - Pending (not yet resulted) → show what they picked (team name / score)
  // - No prediction → italic "No prediction"
  let displayValue: string | null = null;
  let displayMono = false;

  if (noPick) {
    displayValue = null; // handled separately
  } else if (isExact && row.exactScore) {
    displayValue = `${row.exactScore.home}–${row.exactScore.away}`;
    displayMono = true;
  } else if (isCorrect) {
    displayValue = row.winner;
  } else if (isWrong) {
    // User said: lead with result type (team name), not exact score
    displayValue = row.winner;
  } else if (isPending) {
    // Not yet resulted — show what they picked
    if (row.exactScore) {
      displayValue = `${row.exactScore.home}–${row.exactScore.away}`;
      displayMono = true;
    } else {
      displayValue = row.winner;
    }
  }

  // Points pill
  let pillClass = "bg-ps-bg text-ps-text-ter border border-ps-border"; // none / pending
  if (isExact) {
    pillClass = "bg-[#00c87a] text-white";
  } else if (isCorrect) {
    pillClass = "bg-ps-green text-white";
  } else if (isWrong) {
    pillClass = "bg-ps-red text-white";
  } else if (noPick) {
    pillClass = "bg-ps-bg text-ps-text-ter border border-ps-border";
  }

  // Rank display
  const rankDisplay = noPick ? "—" : String(rank);

  // Initials
  const initials = row.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center gap-2.5 border-l-[3px] px-3 py-2.5 ${rowClass} ${rank > 1 ? "border-t border-t-ps-border/40" : ""}`}
    >
      {/* Rank */}
      <span
        className={`w-4 shrink-0 text-center text-[11px] font-semibold ${
          row.isSelf ? "text-ps-amber" : "text-ps-text-ter"
        }`}
      >
        {rankDisplay}
      </span>

      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          row.isSelf
            ? "border-[1.5px] border-ps-amber bg-[#fef3c7] text-ps-text"
            : "border-[1.5px] border-ps-border bg-ps-bg text-ps-text"
        } ${noPick ? "opacity-50" : ""}`}
      >
        {initials}
      </div>

      {/* Name + badges */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={`truncate text-[13px] font-medium ${
            noPick ? "text-ps-text-ter" : "text-ps-text"
          }`}
        >
          {row.displayName}
        </span>
        {row.isSelf && (
          <span className="shrink-0 rounded bg-ps-amber px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.06em] text-ps-text">
            You
          </span>
        )}
        {row.isGroupMember && !row.isSelf && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-ps-amber"
            title="In your group"
          />
        )}
      </div>

      {/* Prediction value */}
      {noPick ? (
        <span className="text-xs italic text-ps-text-ter">
          {t("rivals.no_prediction")}
        </span>
      ) : (
        <span
          className={`text-[13px] font-semibold ${
            isPending ? "font-medium text-ps-text-sec" : "text-ps-text"
          } ${displayMono ? "font-mono" : ""}`}
        >
          {displayValue}
        </span>
      )}

      {/* Points pill */}
      <div
        className={`flex h-[22px] min-w-[30px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${pillClass}`}
      >
        {isPending ? "–" : row.totalPoints}
      </div>
    </div>
  );
}

// ── Inline SVG: Eye icon for "predictions revealed" ─────────────────────────

function EyeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#f59e0b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-0.5"
    >
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}
