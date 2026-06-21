"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { HOST_CITIES, type HostCitySlug } from "@/lib/wc/host-cities";
import { WindowPickList } from "@/app/wc/picks/[windowId]/WindowPickList";
import { ConfidenceMicroPill } from "@/components/ConfidencePills";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

export type FixtureResult = {
  /** "scheduled" | "live" | "resulted" | "locked" */
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  isFinalised: boolean;
};

export type FixturePredictionData = {
  eventId: string;
  competitionId: string;
  sport: string;
  lockTime: string;
  eventStatus: string;
  winnerOptions: string[];   // e.g. ["Mexico", "Draw", "South Korea"]
  hasExactScore: boolean;
  currentWinner: string | null;
  currentScore: { home: number; away: number } | null;
  /** Scoring data — populated for resulted fixtures with predictions */
  winnerCorrect?: boolean | null;
  scoreCorrect?: boolean | null;
  winnerPoints?: number;
  scorePoints?: number;
  userConfidence?: number | null;
};

type TabId = "today" | "upcoming" | "results";

export type FixturesTabsMode = "all" | "fixtures" | "results";

interface Props {
  fixtures: WcFixture[];
  /** Keyed by `WcFixture.externalId`. */
  resultsByExternalId: Record<string, FixtureResult | undefined>;
  /** ISO date (YYYY-MM-DD) — defaults to server's date; client recalculates on mount. */
  serverDateIso: string;
  /** Keyed by `WcFixture.externalId`. */
  predictionsByExternalId?: Record<string, FixturePredictionData | undefined>;
  /**
   * Display mode:
   * - "all"      — full 3-tab UI (Today / Upcoming / Results) — default
   * - "fixtures" — all fixtures in date order, no sub-tabs, no predictions
   * - "results"  — completed fixtures only, with predictions, no sub-tabs
   */
  mode?: FixturesTabsMode;
  // Expand-to-pick data (fixtures mode only)
  windowEventsByExternalId?: Record<string, WindowEvent>;
  fixtureByEventId?: Map<string, WcFixture>;
  fullPredictions?: Prediction[];
  competitionId?: string | null;
  isMember?: boolean;
}

export function FixturesTabs({ fixtures, resultsByExternalId, serverDateIso, predictionsByExternalId = {}, mode = "all", windowEventsByExternalId, fixtureByEventId, fullPredictions, competitionId, isMember }: Props) {
  const t = useT();
  const { locale } = useLocale();
  // Render server-side with the server's idea of "today", then re-derive on
  // mount from the browser. Avoids hydration mismatch on the timezone shift.
  const [todayIso, setTodayIso] = useState(serverDateIso);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setNow(d);
      setTodayIso(localDateIso(d));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const [tab, setTab] = useState<TabId>("today");
  const hasPredictions = Object.keys(predictionsByExternalId).length > 0;
  // Sticky toggles: persist the user's choice across sessions. If they've
  // never set the toggle, fall back to the smart default (showPredictions
  // mirrors hasPredictions; showCorrectness defaults on).
  const [showPredictions, setShowPredictions] = useState(() => {
    if (typeof window === "undefined") return hasPredictions;
    const stored = localStorage.getItem("ps-show-picks");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return hasPredictions;
  });
  const [showCorrectness, setShowCorrectness] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("ps-show-correctness");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return true;
  });
  // Re-read from localStorage on mount to fix stale state when
  // the component re-mounts without re-running the lazy initializer
  // (e.g. React fiber reuse on tab switches).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPicks = localStorage.getItem("ps-show-picks");
    const storedCorrectness = localStorage.getItem("ps-show-correctness");
    if (storedPicks === "true") setShowPredictions(true);
    else if (storedPicks === "false") setShowPredictions(false);
    if (storedCorrectness === "true") setShowCorrectness(true);
    else if (storedCorrectness === "false") setShowCorrectness(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ps-show-picks", String(showPredictions));
  }, [showPredictions]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ps-show-correctness", String(showCorrectness));
  }, [showCorrectness]);
  const [biggerCards, setBiggerCards] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ps-bigger-cards") === "true";
  });
  const hasResults = useMemo(
    () => Object.values(resultsByExternalId).some((r) => r !== undefined),
    [resultsByExternalId],
  );

  const [expandedExternalId, setExpandedExternalId] = useState<string | null>(null);
  const [showConcluded, setShowConcluded] = useState(false);
  const canExpandToPick = mode === "fixtures" && isMember === true && !!windowEventsByExternalId && !!competitionId;

  // Smart default: on first client render, pick best non-empty tab
  const tabInitRef = useRef(false);

  const buckets = useMemo(() => {
    const today: WcFixture[] = [];
    const upcoming: WcFixture[] = [];
    const results: WcFixture[] = [];
    for (const f of fixtures) {
      const kickoff = new Date(f.kickoffUtc);
      const result = resultsByExternalId[f.externalId];
      const isFinished = !!result && (result.homeScore !== null || result.winner !== null);
      const isToday = localDateIso(kickoff) === todayIso;

      if (isFinished) {
        results.push(f);
      } else if (kickoff.getTime() < now.getTime()) {
        // Past kickoff but no result yet — show under Today if still today,
        // else Results (so it doesn't get lost above the live cursor).
        if (isToday) today.push(f);
        else results.push(f);
      } else if (isToday) {
        today.push(f);
      } else {
        upcoming.push(f);
      }
    }
    // Today + upcoming: earliest first. Results: most recent first.
    today.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    upcoming.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    results.sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc));
    return { today, upcoming, results };
  }, [fixtures, resultsByExternalId, todayIso, now]);

  useEffect(() => {
    if (tabInitRef.current || mode !== "all") return;
    tabInitRef.current = true;
    if (buckets.today.length > 0) return;
    if (buckets.upcoming.length > 0) { setTab("upcoming"); return; }
    setTab("results");
  }, [buckets, mode]);

  // Determine which fixtures to display based on mode
  const active = useMemo(() => {
    if (mode === "fixtures") {
      // All fixtures in chronological order — the tournament schedule
      const sorted = [...fixtures].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
      if (!showConcluded) {
        return sorted.filter((f) => {
          const r = resultsByExternalId[f.externalId];
          return !(r && (r.homeScore !== null || r.winner !== null));
        });
      }
      return sorted;
    }
    if (mode === "results") {
      return buckets.results;
    }
    return buckets[tab];
  }, [mode, fixtures, buckets, tab, showConcluded, resultsByExternalId]);

  // Group fixtures by date for "fixtures" mode
  const dateGroups = useMemo(() => {
    if (mode !== "fixtures") return null;
    const groups: { label: string; dateKey: string; items: WcFixture[] }[] = [];
    let currentKey = "";
    const intlLocale = locale === "es" ? "es-MX" : "en-GB";
    for (const f of active) {
      const d = new Date(f.kickoffUtc);
      // Use browser-local date for grouping key (matches localDateIso used
      // by the bucket logic). toISOString().slice(0,10) would use UTC, which
      // misgroups fixtures near midnight for users west of UTC.
      const key = localDateIso(d);
      if (key !== currentKey) {
        currentKey = key;
        groups.push({
          // Omit timeZone to use the browser's local timezone — Intl handles
          // DST automatically via the IANA tz database.
          label: d.toLocaleDateString(intlLocale, { weekday: "short", day: "numeric", month: "short" }),
          dateKey: key,
          items: [],
        });
      }
      groups[groups.length - 1].items.push(f);
    }
    return groups;
  }, [mode, active, locale]);

  const showSubTabs = mode === "all";
  const showPredToggles = mode !== "fixtures" && hasPredictions;
  const effectivePredictions = mode === "fixtures" ? {} : predictionsByExternalId;

  return (
    <div>
      {showSubTabs && (
        <div role="tablist" className="mt-4 flex gap-1 rounded-lg border border-ps-border bg-ps-surface p-1">
          <TabButton id="today" current={tab} onSelect={setTab} count={buckets.today.length}>
            {t('fixtures.today')}
          </TabButton>
          <TabButton id="upcoming" current={tab} onSelect={setTab} count={buckets.upcoming.length}>
            {t('fixtures.upcoming')}
          </TabButton>
          <TabButton id="results" current={tab} onSelect={setTab} count={buckets.results.length}>
            {t('fixtures.results')}
          </TabButton>
        </div>
      )}

      {showPredToggles && (
        <div className="mt-3 space-y-0 rounded-lg border border-ps-border bg-ps-surface px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ps-text-sec">
              {showPredictions ? t('fixtures.hide_picks') : t('fixtures.show_picks')}
            </span>
            <ToggleSwitch
              label=""
              checked={showPredictions}
              onChange={() => setShowPredictions((v) => !v)}
            />
          </div>
          {showPredictions && hasResults && (
            <div className="flex items-center justify-between border-t border-ps-border/50 pt-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="block h-2.5 w-2.5 rounded-sm bg-ps-green/70" />
                  <span className="block h-2.5 w-2.5 rounded-sm bg-ps-red/70" />
                </span>
                <span className="text-xs text-ps-text-sec">
                  {t('fixtures.show_correct_wrong')}
                </span>
              </div>
              <ToggleSwitch
                label=""
                checked={showCorrectness}
                onChange={() => setShowCorrectness((v) => !v)}
              />
            </div>
          )}
        </div>
      )}

      {mode === "fixtures" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowConcluded((v) => !v)}
            className={[
              "w-full rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors",
              showConcluded
                ? "bg-ps-text text-ps-bg dark:bg-ps-bg dark:text-ps-text"
                : "border border-ps-border bg-ps-surface text-ps-text-sec",
            ].join(" ")}
          >
            {showConcluded ? t('fixtures.hide_concluded') : t('fixtures.show_concluded')}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {active.length === 0 && (
          <p className="rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
            {mode === "fixtures"
              ? t('fixtures.no_fixtures')
              : mode === "results"
                ? t('fixtures.no_results')
                : tab === "today"
                  ? t('fixtures.no_today')
                  : tab === "upcoming"
                    ? t('fixtures.no_upcoming')
                    : t('fixtures.no_results')}
          </p>
        )}

        {dateGroups
          ? dateGroups.map((group) => (
              <div key={group.dateKey}>
                <h3 className="mb-2 mt-4 first:mt-0 font-mono text-micro font-bold uppercase tracking-[0.18em] text-ps-text-sec">
                  {group.label}
                </h3>
                <div className="space-y-3">
                  {group.items.map((f) => {
                    const windowEvent = canExpandToPick ? windowEventsByExternalId?.[f.externalId] : undefined;
                    const result = resultsByExternalId[f.externalId];
                    const isFinished = !!result && (result.homeScore !== null || result.winner !== null);
                    const isLocked = windowEvent ? new Date(windowEvent.lock_time) <= new Date() : true;
                    const isExpandable = !!windowEvent && canExpandToPick && !isFinished && !isLocked;
                    const isExpanded = expandedExternalId === f.externalId;

                    // Expanded: replace card with WindowPickList
                    if (isExpanded && windowEvent && fixtureByEventId && competitionId) {
                      const eventPredictions = (fullPredictions ?? []).filter(
                        (p) => p.event_id === windowEvent.id
                      );
                      return (
                        <div key={f.externalId} className="relative animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={() => setExpandedExternalId(null)}
                            className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                            aria-label="Close prediction"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                          </button>
                          <WindowPickList
                            competitionId={competitionId}
                            events={[windowEvent]}
                            predictions={eventPredictions}
                            windowLocked={false}
                            surface="card"
                            fixtureByEventId={fixtureByEventId}
                          />
                        </div>
                      );
                    }

                    // Collapsed: normal FixtureCard with optional CTA
                    return (
                      <FixtureCard
                        key={f.externalId}
                        fixture={f}
                        result={result}
                        prediction={undefined}
                        showCorrectness={false}
                        large={biggerCards}
                        expandable={isExpandable}
                        onExpand={() => setExpandedExternalId(f.externalId)}
                        locale={locale}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          : active.map((f) => {
              const fResult = resultsByExternalId[f.externalId];
              const fPred = effectivePredictions[f.externalId];
              const isResulted = !!fResult && (fResult.homeScore !== null || fResult.winner !== null);
              return (
                <FixtureCard
                  key={f.externalId}
                  fixture={f}
                  result={fResult}
                  prediction={showPredictions ? fPred : undefined}
                  showCorrectness={showPredictions && showCorrectness}
                  large={biggerCards}
                  locale={locale}
                  rivalsEventId={
                    mode === "results" && isResulted && showPredictions && fPred?.eventId
                      ? fPred.eventId
                      : undefined
                  }
                />
              );
            })}
      </div>
    </div>
  );
}

function TabButton({
  id,
  current,
  onSelect,
  count,
  children,
}: {
  id: TabId;
  current: TabId;
  onSelect: (id: TabId) => void;
  count: number;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
      className={[
        "flex-1 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-ps-text text-ps-bg"
          : "text-ps-text-sec hover:text-ps-text",
      ].join(" ")}
    >
      {children}
      <span
        className={[
          "ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 font-mono text-caption tabular-nums",
          active ? "bg-ps-bg/20 text-ps-bg" : "bg-ps-border/60 text-ps-text-sec",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-caption font-semibold text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
    >
      {label}
      <span
        className={[
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-ps-amber" : "bg-ps-border",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function FixtureCard({
  fixture,
  result,
  prediction,
  showCorrectness,
  large,
  expandable = false,
  onExpand,
  locale = "en",
  rivalsEventId,
}: {
  fixture: WcFixture;
  result: FixtureResult | undefined;
  prediction: FixturePredictionData | undefined;
  showCorrectness: boolean;
  large: boolean;
  expandable?: boolean;
  onExpand?: () => void;
  locale?: string;
  rivalsEventId?: string;
}) {
  const t = useT();
  const city = HOST_CITIES[fixture.city as HostCitySlug];
  const kickoff = new Date(fixture.kickoffUtc);

  const isFinished = !!result && (result.homeScore !== null || result.winner !== null);
  const isLocked = prediction
    ? new Date(prediction.lockTime) <= new Date() || prediction.eventStatus !== "upcoming"
    : true;
  const canPredict = !!prediction && !isFinished && !isLocked;

  // ── Prediction state ──
  const [currentWinner, setCurrentWinner] = useState<string | null>(
    prediction?.currentWinner ?? null,
  );
  const [homeScore, setHomeScore] = useState<string>(() => {
    const s = prediction?.currentScore;
    return s !== null && s !== undefined ? String(s.home) : "";
  });
  const [awayScore, setAwayScore] = useState<string>(() => {
    const s = prediction?.currentScore;
    return s !== null && s !== undefined ? String(s.away) : "";
  });
  const [error, setError] = useState<string | null>(null);

  const awayInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Derive winner options — fallback to fixture team names if EPT has none
  const winnerOptions = prediction?.winnerOptions?.length
    ? prediction.winnerOptions
    : [fixture.home, "Draw", fixture.away];
  const drawOption = winnerOptions.find(
    (opt) => opt !== fixture.home && opt !== fixture.away,
  ) ?? "Draw";

  const submitPrediction = useCallback(
    async (
      predictionType: string,
      predictionData: Record<string, unknown>,
      signal?: AbortSignal,
    ) => {
      if (!prediction) return;
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: prediction.eventId,
          competition_id: prediction.competitionId,
          prediction_type: predictionType,
          prediction_data: predictionData,
        }),
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to save");
      }
    },
    [prediction],
  );

  const handlePickWinner = useCallback(
    (value: string) => {
      if (!canPredict) return;
      if (value === currentWinner) return;

      const prev = currentWinner;
      setCurrentWinner(value);
      setError(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      submitPrediction("winner", { value }, controller.signal).catch(
        (err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setCurrentWinner(prev);
          setError(err instanceof Error ? err.message : "Couldn't save");
        },
      );
    },
    [canPredict, currentWinner, submitPrediction],
  );

  const handleScoreBlur = useCallback(
    (latestHome: string, latestAway: string) => {
      if (!canPredict || !prediction?.hasExactScore) return;

      const h = parseInt(latestHome, 10);
      const a = parseInt(latestAway, 10);
      if (latestHome === "" || latestAway === "" || isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

      // Derive and set winner atomically
      const implied = h > a ? fixture.home : a > h ? fixture.away : drawOption;
      if (implied !== currentWinner) {
        handlePickWinner(implied);
      }

      submitPrediction("exact_score", { home: h, away: a }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("prediction.error_save"));
      });
    },
    [canPredict, prediction, fixture.home, fixture.away, drawOption, currentWinner, handlePickWinner, submitPrediction],
  );

  // ── Derived display state ──
  const hasPrediction = currentWinner !== null || homeScore !== "" || awayScore !== "";
  const homeSelected = currentWinner === fixture.home;
  const awaySelected = currentWinner === fixture.away;
  const drawSelected = currentWinner === drawOption;

  // ── Scoring-derived state (for results mode) ──
  const winnerCorrect = prediction?.winnerCorrect ?? null;
  const scoreCorrect = prediction?.scoreCorrect ?? null;
  const winnerPoints = prediction?.winnerPoints ?? 0;
  const scorePoints = prediction?.scorePoints ?? 0;
  const totalPoints = winnerPoints + scorePoints;
  const bothCorrect = winnerCorrect === true && scoreCorrect === true;
  const winnerOnly = winnerCorrect === true && scoreCorrect !== true;
  const isWrong = hasPrediction && winnerCorrect === false;
  const isJackpot = bothCorrect; // exact score = shimmer

  // Movement direction: points > 0 = up, predicted but 0 points = down, else neutral
  const movement: "up" | "down" | "neutral" =
    !hasPrediction || !isFinished ? "neutral"
    : totalPoints > 0 ? "up"
    : "down";

  // Ring color: green (correct), red (wrong), amber (pending / correctness off)
  let ringClass = "";
  if (hasPrediction && prediction) {
    if (isFinished && result && currentWinner) {
      // Determine actual winner from result
      const actualWinner =
        result.homeScore !== null && result.awayScore !== null
          ? result.homeScore > result.awayScore
            ? fixture.home
            : result.awayScore > result.homeScore
              ? fixture.away
              : drawOption
          : result.winner ?? null;

      if (showCorrectness && actualWinner) {
        ringClass =
          currentWinner === actualWinner
            ? "ring-[6px] ring-ps-green/85 my-[3px]"
            : "ring-[6px] ring-ps-red/85 my-[3px]";
      } else {
        ringClass = "ring-2 ring-ps-amber/50";
      }
    } else {
      // Upcoming / pending — amber ring
      ringClass = "ring-2 ring-ps-amber/50";
    }
  }

  const cityTime = formatTime(kickoff, city.timezone, locale);
  const cityDate = formatDateShort(kickoff, city.timezone, locale);
  const localTime = formatTime(kickoff, undefined, locale);
  const localTzAbbr = formatTzAbbr(kickoff, locale);
  const sameClock = cityTime === localTime;

  // Size tokens — default vs large
  const flagSize = large ? 36 : 24;
  const flagSizeRo = large ? 32 : 24;
  const teamText = large ? "text-sm" : "text-xs";
  const scoreSize = large ? "w-[40px] h-[38px] text-lg" : "w-[30px] h-[28px] text-sm";
  const drawSize = large ? "px-3.5 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  const teamPad = large ? "gap-1.5 px-2 py-2" : "gap-1 px-1.5 py-1.5";
  const headerText = large ? "text-xs" : "text-caption";
  const stadiumText = large ? "text-caption" : "text-micro";
  const bodyPad = large ? "px-5 pb-4 pt-3" : "px-4 pb-3 pt-2";
  const headerPad = large ? "px-5 pt-4" : "px-4 pt-3";
  const rowGap = large ? "gap-2" : "gap-1.5";
  const timeText = large ? "text-sm" : "text-xs";

  return (
    <article
      className={[
        large ? "overflow-hidden rounded-2xl text-white shadow-sm transition-all"
              : "overflow-hidden rounded-xl text-white shadow-sm transition-all",
        ringClass,
        // Left stripe for wrong predictions (matches dashboard pattern)
        showCorrectness && isWrong && isFinished ? "border-l-[3px] border-l-ps-red" : "",
      ].join(" ")}
      style={{ backgroundColor: city.color }}
    >
      {/* Header: stage + city/stadium */}
      <header className={`flex items-center justify-between gap-2 ${headerPad} ${headerText} font-bold uppercase tracking-wide text-white/85`}>
        <span className="shrink-0">
          {fixture.stage === "group"
            ? t('fixtures.stage_group', { group: fixture.group ?? '', matchday: String(fixture.matchday ?? '') })
            : stageLabel(fixture.stage, t)}
        </span>
        <span className="min-w-0 text-right">
          <span className="block truncate">{city.name}</span>
          <span className={`block truncate ${stadiumText} font-medium normal-case tracking-normal text-white/50`}>
            {city.stadium}
          </span>
        </span>
      </header>

      <div className={bodyPad}>
        {/* ── Prediction row (upcoming + unlocked) ── */}
        {canPredict && (
          <>
            <div className={`flex items-center justify-center ${rowGap}`}>
              {/* Home team button */}
              <button
                type="button"
                onClick={() => handlePickWinner(fixture.home)}
                className={[
                  `flex-1 min-w-0 flex flex-col items-center ${teamPad} rounded-lg transition-all duration-150 cursor-pointer`,
                  homeSelected
                    ? "bg-white/12 shadow-[inset_0_0_0_2px_rgba(212,175,55,0.7)]"
                    : "hover:bg-white/8",
                ].join(" ")}
              >
                <CountryFlag shape="pill" name={fixture.home} size={flagSize} />
                <span
                  className={[
                    `max-w-full truncate ${teamText} font-semibold text-center leading-tight`,
                    homeSelected ? "text-white" : "text-white/55",
                  ].join(" ")}
                >
                  {fixture.home}
                </span>
              </button>

              {/* Home score input */}
              {prediction?.hasExactScore && (
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="–"
                  value={homeScore}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setHomeScore(val);
                    if (val !== "" && awayInputRef.current) {
                      awayInputRef.current.focus();
                    }
                  }}
                  onBlur={() => handleScoreBlur(homeScore, awayScore)}
                  aria-label={`${fixture.home} score`}
                  className={[
                    `${scoreSize} rounded-full border text-center font-mono font-semibold tabular-nums text-white outline-none transition-all duration-150 shrink-0`,
                    homeScore !== ""
                      ? "bg-black/30 border-ps-amber"
                      : "bg-black/20 border-white/30",
                    "focus:border-ps-amber focus:bg-black/35",
                    "placeholder:text-white/40",
                  ].join(" ")}
                />
              )}

              {/* Draw button */}
              <button
                type="button"
                onClick={() => handlePickWinner(drawOption)}
                className={[
                  `shrink-0 ${drawSize} rounded-lg font-medium transition-all duration-150 cursor-pointer`,
                  drawSelected
                    ? "bg-white/12 text-white shadow-[inset_0_0_0_2px_rgba(212,175,55,0.7)]"
                    : "text-white/45 hover:bg-white/8 hover:text-white/65",
                ].join(" ")}
              >
                {t('fixtures.draw')}
              </button>

              {/* Away score input */}
              {prediction?.hasExactScore && (
                <input
                  ref={awayInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="–"
                  value={awayScore}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setAwayScore(val);
                  }}
                  onBlur={() => handleScoreBlur(homeScore, awayScore)}
                  aria-label={`${fixture.away} score`}
                  className={[
                    `${scoreSize} rounded-full border text-center font-mono font-semibold tabular-nums text-white outline-none transition-all duration-150 shrink-0`,
                    awayScore !== ""
                      ? "bg-black/30 border-ps-amber"
                      : "bg-black/20 border-white/30",
                    "focus:border-ps-amber focus:bg-black/35",
                    "placeholder:text-white/40",
                  ].join(" ")}
                />
              )}

              {/* Away team button */}
              <button
                type="button"
                onClick={() => handlePickWinner(fixture.away)}
                className={[
                  `flex-1 min-w-0 flex flex-col items-center ${teamPad} rounded-lg transition-all duration-150 cursor-pointer`,
                  awaySelected
                    ? "bg-white/12 shadow-[inset_0_0_0_2px_rgba(212,175,55,0.7)]"
                    : "hover:bg-white/8",
                ].join(" ")}
              >
                <CountryFlag shape="pill" name={fixture.away} size={flagSize} />
                <span
                  className={[
                    `max-w-full truncate ${teamText} font-semibold text-center leading-tight`,
                    awaySelected ? "text-white" : "text-white/55",
                  ].join(" ")}
                >
                  {fixture.away}
                </span>
              </button>
            </div>

            {error && (
              <p className="mt-1 text-center text-micro font-medium text-red-300">{error}</p>
            )}
          </>
        )}

        {/* ── Read-only teams + result (finished) ── */}
        {isFinished && (
          <>
            {/* Compact scoreboard row with gradient wash + inner glow */}
            <div
              className={[
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                showCorrectness && hasPrediction
                  ? winnerCorrect
                    ? "bg-gradient-to-br from-ps-green/30 to-black/30 shadow-[inset_0_0_0_1.5px_rgba(10,168,109,0.65),0_0_10px_rgba(10,168,109,0.15)]"
                    : "bg-gradient-to-br from-ps-red/30 to-black/30 shadow-[inset_0_0_0_1.5px_rgba(226,61,79,0.65),0_0_10px_rgba(226,61,79,0.15)]"
                  : "bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
              ].join(" ")}
            >
              <CountryFlag shape="pill" name={fixture.home} size={18} />
              <span className="text-xs font-bold text-white">{fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase()}</span>
              <span className="flex-1 text-center font-mono text-sm font-extrabold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {result?.homeScore !== null && result?.awayScore !== null
                  ? `${result.homeScore} – ${result.awayScore}`
                  : (result?.winner ?? "Result")}
              </span>
              <span className="text-xs font-bold text-white">{fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase()}</span>
              <CountryFlag shape="pill" name={fixture.away} size={18} />
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-micro font-bold uppercase leading-none",
                  result?.isFinalised ? "bg-ps-green/80 text-white" : "bg-black/25 text-white/75 ring-1 ring-inset ring-white/15",
                ].join(" ")}
              >
                {result?.isFinalised ? "FT" : t('fixtures.result_provisional')}
              </span>
            </div>

            {/* Verdict row: arrow block | prediction | points block */}
            {hasPrediction && prediction && showCorrectness && (
              <div className="mt-1.5 flex overflow-hidden rounded-lg">
                {/* Arrow block — dark-backed with colored border */}
                <div
                  className={[
                    "flex w-9 shrink-0 items-center justify-center bg-black/45",
                    winnerCorrect
                      ? "border-r-[2.5px] border-r-ps-green"
                      : "border-r-[2.5px] border-r-ps-red",
                  ].join(" ")}
                >
                  {movement === "up" && (
                    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ps-green" aria-hidden="true">
                      <path d="M6 10V2M3 5l3-3 3 3" />
                    </svg>
                  )}
                  {movement === "down" && (
                    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ps-red" aria-hidden="true">
                      <path d="M6 2v8M3 7l3 3 3-3" />
                    </svg>
                  )}
                  {movement === "neutral" && (
                    <span className="text-base font-extrabold text-white/35" aria-hidden="true">—</span>
                  )}
                </div>

                {/* Center — prediction text */}
                <div className="flex flex-1 items-center bg-black/25 px-2.5 py-2">
                  <span className="text-xs text-white/55">
                    {t('dash.prediction_label')}{" "}
                    <span className="font-bold text-white/90">
                      {currentWinner}
                      {homeScore !== "" && awayScore !== "" ? ` ${homeScore}\u2013${awayScore}` : ""}
                    </span>
                  </span>
                </div>

                {/* Points block — solid color */}
                <div
                  className={[
                    "flex w-12 shrink-0 items-center justify-center",
                    winnerCorrect ? "bg-ps-green" : "bg-ps-red",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-mono text-base font-extrabold text-white tabular-nums",
                      isJackpot ? "ps-jackpot-shimmer" : "",
                    ].join(" ")}
                  >
                    +{totalPoints}
                  </span>
                </div>
              </div>
            )}

            {/* Prediction row without correctness (before results revealed) */}
            {hasPrediction && prediction && !showCorrectness && (
              <div className="mt-1.5 rounded-lg bg-black/20 px-3 py-2">
                <span className="text-xs text-white/55">
                  {t('dash.prediction_label')}{" "}
                  <span className="font-bold text-white/90">
                    {currentWinner}
                    {homeScore !== "" && awayScore !== "" ? ` ${homeScore}\u2013${awayScore}` : ""}
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Read-only teams (upcoming but locked / no prediction context) ── */}
        {!isFinished && !canPredict && (
          <div className="flex items-center justify-between gap-2">
            <h3 className={`flex flex-wrap items-center gap-1.5 ${large ? "text-lg" : "text-base"} font-bold text-white`}>
              <CountryFlag shape="pill" name={fixture.home} size={flagSizeRo} />
              <span>{fixture.home}</span>
              <span className="mx-0.5 text-white/70">v</span>
              <CountryFlag shape="pill" name={fixture.away} size={flagSizeRo} />
              <span>{fixture.away}</span>
            </h3>
            {expandable && onExpand && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onExpand(); }}
                className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-caption font-bold text-white transition-colors hover:bg-white/30 active:bg-white/40"
              >
                {t('fixtures.pick_cta')}
              </button>
            )}
          </div>
        )}

        {/* ── Time info (upcoming only) ── */}
        {!isFinished && (
          <dl className={`mt-2 grid grid-cols-2 gap-x-3 ${timeText} text-white/90`}>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-white/70">
                {t('fixtures.in_city', { cityName: city.shortName })}
              </dt>
              <dd className="font-mono tabular-nums">
                {cityTime}
                <span className="ml-1 text-white/70">· {cityDate}</span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-white/70">{t('fixtures.your_time')}</dt>
              <dd className="font-mono tabular-nums">
                {sameClock ? t('fixtures.same_tz') : `${localTime} ${localTzAbbr}`}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Rivals CTA — ghost button on resulted matches */}
      {rivalsEventId && isFinished && (
        <div className="bg-ps-surface px-4 py-3.5 text-center dark:bg-ps-chip">
          <a
            href={`/wc/leaderboard?tab=rivals&eventId=${rivalsEventId}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-ps-amber bg-ps-amber px-5 py-2.5 text-sm font-semibold text-ps-text transition-colors hover:brightness-110"
          >
            {t("rivals.see_what_others")}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      )}
    </article>
  );
}

function stageLabel(stage: WcFixture["stage"], t: (key: string) => string): string {
  switch (stage) {
    case "R32": return t('fixtures.stage_r32');
    case "R16": return t('fixtures.stage_r16');
    case "QF": return t('fixtures.stage_qf');
    case "SF": return t('fixtures.stage_sf');
    case "3RD": return t('fixtures.stage_3rd');
    case "FINAL": return t('fixtures.stage_final');
    default: return stage;
  }
}

function formatTime(date: Date, timeZone: string | undefined, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function formatDateShort(date: Date, timeZone: string | undefined, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function formatTzAbbr(date: Date, locale = "en"): string {
  const parts = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-GB", {
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

function localDateIso(date: Date): string {
  // Browser-local YYYY-MM-DD, matched against fixture kickoff converted to
  // the same local zone. We intentionally use the device's zone, not city tz —
  // "today" means "today where the user is sitting."
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
