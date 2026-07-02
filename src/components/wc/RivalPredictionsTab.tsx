"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { CascadeCard } from "@/components/CascadeCard";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

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
  groupName: string | null;
  groupId: string | null;
  confidenceLevel: number | null;
  goesThrough: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [eventMeta, setEventMeta] = useState<EventMeta | null>(null);
  const [sortMode, setSortMode] = useState<"points" | "group">("points");

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
        if (!cancelled) {
          setError(t("rivals.error_load"));
          setLoading(false);
        }
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
        if (!cancelled) {
          setError(t("rivals.error_load"));
          setPredLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId, selectedFixture?.eventId]);

  const sortedPredictions = useMemo(() => {
    if (sortMode === "points") return predictions;
    // Flat list sorted: user's group first, then other groups alphabetically
    const userGroupId = predictions.find((r) => r.isSelf)?.groupId;
    const grouped = new Map<string, RivalPrediction[]>();
    const ungrouped: RivalPrediction[] = [];
    for (const r of predictions) {
      if (!r.groupId) { ungrouped.push(r); continue; }
      if (!grouped.has(r.groupId)) grouped.set(r.groupId, []);
      grouped.get(r.groupId)!.push(r);
    }
    // Sort group keys: user's group first, rest alphabetically by name
    const sortedKeys = [...grouped.keys()].sort((a, b) => {
      if (a === userGroupId) return -1;
      if (b === userGroupId) return 1;
      const nameA = grouped.get(a)![0]?.groupName ?? "";
      const nameB = grouped.get(b)![0]?.groupName ?? "";
      return nameA.localeCompare(nameB);
    });
    const result: RivalPrediction[] = [];
    for (const key of sortedKeys) result.push(...grouped.get(key)!);
    result.push(...ungrouped);
    return result;
  }, [predictions, sortMode]);

  // Group headers for "group" sort mode — maps first row index of each group to its name
  const groupHeaders = useMemo(() => {
    if (sortMode !== "group") return new Map<number, string>();
    const headers = new Map<number, string>();
    let lastGroupId: string | null = null;
    for (let i = 0; i < sortedPredictions.length; i++) {
      const r = sortedPredictions[i];
      if (r.groupId && r.groupId !== lastGroupId) {
        const isUserGroup = r.isGroupMember || r.isSelf;
        headers.set(i, isUserGroup ? `${r.groupName} (You)` : r.groupName!);
        lastGroupId = r.groupId;
      } else if (!r.groupId && lastGroupId !== "ungrouped") {
        headers.set(i, "Ungrouped");
        lastGroupId = "ungrouped";
      }
    }
    return headers;
  }, [sortMode, sortedPredictions]);

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

  // ── Error state ─────────────────────────────────────────────────────────
  if (error && fixtures.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center">
        <p className="text-sm text-ps-red">{error}</p>
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
  // Two formats: NormalizedResult { score: { home_score, away_score }, winner }
  //              or flat { home_score, away_score, winner }
  const rd = (eventMeta?.resultData ?? selectedFixture?.resultData) as Record<string, unknown> | null;
  const resultConfirmed = eventMeta?.resultConfirmed ?? selectedFixture?.resultConfirmed ?? false;
  const scoreNested = rd?.score as Record<string, unknown> | undefined;
  const homeScore = rd ? numOrNull(scoreNested?.home_score ?? rd.home_score ?? rd.homeScore) : null;
  const awayScore = rd ? numOrNull(scoreNested?.away_score ?? rd.away_score ?? rd.awayScore) : null;
  const hasResult = resultConfirmed && homeScore !== null;

  // Extract penalty shootout scores
  const periodsObj = (typeof scoreNested?.periods === "object" && scoreNested?.periods !== null ? scoreNested.periods : {}) as Record<string, { home?: number; away?: number }>;
  const penData = periodsObj.penalties;
  const penHome = penData?.home !== undefined ? Number(penData.home) : null;
  const penAway = penData?.away !== undefined ? Number(penData.away) : null;
  const hasPenalties = penHome !== null && penAway !== null && !isNaN(penHome) && !isNaN(penAway);

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
            <p className="mb-2.5 font-mono text-micro font-bold uppercase tracking-[0.10em] text-ps-text-ter">
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
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-ps-border bg-ps-bg text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-30"
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
              <p className="truncate text-item-label font-bold text-ps-text">
                {selectedFixture?.name}
              </p>
              <p className="mt-0.5 font-mono text-caption text-ps-text-sec">
                {fixtureDate} · {fixtureTime}
              </p>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={fixtureIdx === fixtures.length - 1}
              aria-label="Next fixture"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-ps-border bg-ps-bg text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-30"
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
                <span className="text-caption font-semibold text-ps-green">
                  {t("rivals.final")}
                </span>
                <span className="text-caption text-ps-text-ter">·</span>
                <span className="font-mono text-caption font-semibold text-ps-green">
                  {homeScore} – {awayScore}{hasPenalties ? ` (${penHome}–${penAway} pens)` : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-md bg-ps-amber/10 px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ps-amber" />
                <EyeIcon />
                <span className="text-caption font-semibold text-ps-amber">
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
          <button
            type="button"
            onClick={() => setSortMode((m) => (m === "points" ? "group" : "points"))}
            className="text-caption font-semibold text-ps-amber"
          >
            {sortMode === "points" ? t("rivals.sort_points") : t("rivals.sort_group")}
          </button>
        </div>

        {/* Prediction rows */}
        {predLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ps-text-ter border-t-ps-text" />
          </div>
        ) : (
          <div className="overflow-hidden">
            {sortedPredictions.map((row, i) => (
              <CascadeCard key={row.userId} index={i} speed="rise">
                <div>
                  {groupHeaders.has(i) && (
                    <div className="border-t border-ps-border/50 bg-ps-bg px-4 py-1.5">
                      <span className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter">
                        {groupHeaders.get(i)}
                      </span>
                    </div>
                  )}
                  <PredictionRow
                    row={row}
                    rank={i + 1}
                    hasResult={hasResult}
                  />
                </div>
              </CascadeCard>
            ))}

            {/* Scroll hint when list is long */}
            {sortedPredictions.length > 8 && (
              <div className="border-t border-ps-border/50 px-4 py-2.5 text-center text-caption font-medium text-ps-text-ter">
                {t("rivals.scroll_more", {
                  count: predictions.length - 8,
                })}
              </div>
            )}
          </div>
        )}

        {/* Chat CTA */}
        <div className="border-t border-ps-border/50 px-4 py-3 text-center">
          <Link
            href="/wc/chat"
            className="text-xs text-ps-text-sec hover:text-ps-text hover:underline"
          >
            {t("chat.something_to_say")}
          </Link>
        </div>
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
  const [flipped, setFlipped] = useState(false);

  const noPick = row.winner === null;
  const isPending = !noPick && row.winnerCorrect === null;
  const isExact = row.scoreCorrect === true;
  const isCorrect = !isExact && row.winnerCorrect === true;
  const isWrong = row.winnerCorrect === false;

  // Row variant classes
  let rowClass = "border-l-transparent bg-transparent"; // pending / default
  if (row.isSelf) {
    rowClass = "border-l-ps-amber bg-ps-amber-soft";
  } else if (isExact) {
    rowClass = "border-l-[#00c87a] bg-ps-green-soft";
  } else if (isCorrect) {
    rowClass = "border-l-ps-green bg-ps-green-soft";
  } else if (isWrong) {
    rowClass = "border-l-ps-red bg-ps-red-soft";
  } else if (noPick) {
    rowClass = "border-l-ps-border bg-transparent";
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
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Can flip: only if they made a prediction
  const canFlip = !noPick;

  return (
    <div
      className="relative"
      style={{ perspective: "600px" }}
    >
      <div
        className={`transition-transform duration-300 ${canFlip ? "cursor-pointer" : ""}`}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateX(180deg)" : "rotateX(0deg)",
        }}
        onClick={canFlip ? () => setFlipped((f) => !f) : undefined}
      >
        {/* ── Front face ──────────────────────────────────────────── */}
        <div
          className={`flex items-center gap-2.5 border-l-[3px] px-3 py-2.5 ${rowClass} ${rank > 1 ? "border-t border-t-ps-border/40" : ""} transition-opacity duration-300 ${flipped ? "opacity-0" : "opacity-100"}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Rank */}
          <span
            className={`w-4 shrink-0 text-center text-caption font-semibold ${
              row.isSelf ? "text-ps-amber" : "text-ps-text-ter"
            }`}
          >
            {rankDisplay}
          </span>

          {/* Avatar */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-bold ${
              row.isSelf
                ? "border-[1.5px] border-ps-amber bg-ps-amber-soft text-ps-text"
                : "border-[1.5px] border-ps-border bg-ps-bg text-ps-text"
            } ${noPick ? "opacity-50" : ""}`}
          >
            {initials}
          </div>

          {/* Name + badges */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={`truncate text-body font-medium ${
                noPick ? "text-ps-text-ter" : "text-ps-text"
              }`}
            >
              {row.displayName}
            </span>
            {row.isSelf && (
              <span className="shrink-0 rounded bg-ps-amber px-1.5 py-px text-micro font-bold uppercase tracking-[0.06em] text-ps-text">
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

          {/* Prediction value — always show the team name on front */}
          {noPick ? (
            <span className="shrink-0 text-xs italic text-ps-text-ter">
              {t("rivals.no_prediction")}
            </span>
          ) : (
            <div className="flex min-w-0 flex-col">
              <span
                className={`max-w-[120px] truncate text-body font-semibold ${
                  isPending ? "font-medium text-ps-text-sec" : "text-ps-text"
                }`}
              >
                {row.winner}
              </span>
              {row.goesThrough && row.goesThrough !== row.winner && (
                <span className="max-w-[120px] truncate text-micro text-ps-text-ter">
                  → {row.goesThrough}
                </span>
              )}
            </div>
          )}

          {/* Confidence indicator — hidden until progressive disclosure is ready */}

          {/* Points pill */}
          <div
            className={`flex h-[22px] min-w-[30px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${pillClass}`}
          >
            {isPending ? "–" : row.totalPoints}
          </div>
        </div>

        {/* ── Back face ───────────────────────────────────────────── */}
        <div
          className={`absolute inset-0 flex items-center gap-2.5 border-l-[3px] px-3 py-2.5 ${rowClass} ${rank > 1 ? "border-t border-t-ps-border/40" : ""}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateX(180deg)",
          }}
        >
          {/* Outcome icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            {isExact ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="#00c87a" aria-label="Exact score">
                <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8z" />
              </svg>
            ) : isCorrect ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="#22c55e" strokeWidth="2" />
                <path d="M6 10.5l2.5 2.5L14 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : isWrong ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeWidth="2" />
                <path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="#9ca3af" strokeWidth="2" />
                <path d="M6 10h8" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {/* Outcome label */}
          <span
            className={`text-caption font-semibold ${
              isExact
                ? "text-[#00c87a]"
                : isCorrect
                  ? "text-ps-green"
                  : isWrong
                    ? "text-ps-red"
                    : "text-ps-text-sec"
            }`}
          >
            {isExact
              ? t("rivals.exact_score")
              : isCorrect
                ? t("rivals.correct")
                : isWrong
                  ? t("rivals.incorrect")
                  : t("rivals.pending")}
          </span>

          <div className="flex-1" />

          {/* Predicted score */}
          {row.exactScore ? (
            <div className="flex items-center gap-1.5">
              <span className="text-caption text-ps-text-sec">{t("rivals.predicted_score")}</span>
              <span className="font-mono text-item-label font-bold text-ps-text">
                {row.exactScore.home}–{row.exactScore.away}
              </span>
            </div>
          ) : (
            <span className="text-caption text-ps-text-ter italic">
              {t("rivals.no_score_predicted")}
            </span>
          )}

          {/* Goes through (knockout draw predictions) */}
          {row.goesThrough && row.goesThrough !== row.winner && (
            <span className="text-caption text-ps-text-sec">
              → {row.goesThrough}
            </span>
          )}

          {/* Points pill (same as front) */}
          <div
            className={`flex h-[22px] min-w-[30px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${pillClass}`}
          >
            {isPending ? "–" : row.totalPoints}
          </div>
        </div>
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

