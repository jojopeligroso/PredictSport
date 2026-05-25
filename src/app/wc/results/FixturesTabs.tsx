"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { HOST_CITIES, type HostCitySlug } from "@/lib/wc/host-cities";
import type { WcFixture } from "@/lib/wc/fixtures";

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
};

type TabId = "today" | "upcoming" | "results";

interface Props {
  fixtures: WcFixture[];
  /** Keyed by `WcFixture.externalId`. */
  resultsByExternalId: Record<string, FixtureResult | undefined>;
  /** ISO date (YYYY-MM-DD) — defaults to server's date; client recalculates on mount. */
  serverDateIso: string;
  /** Keyed by `WcFixture.externalId`. */
  predictionsByExternalId?: Record<string, FixturePredictionData | undefined>;
}

export function FixturesTabs({ fixtures, resultsByExternalId, serverDateIso, predictionsByExternalId = {} }: Props) {
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
  const [showPredictions, setShowPredictions] = useState(hasPredictions);
  const [showCorrectness, setShowCorrectness] = useState(true);
  const hasResults = useMemo(
    () => Object.values(resultsByExternalId).some((r) => r !== undefined),
    [resultsByExternalId],
  );

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
    if (tabInitRef.current) return;
    tabInitRef.current = true;
    if (buckets.today.length > 0) return;
    if (buckets.upcoming.length > 0) { setTab("upcoming"); return; }
    setTab("results");
  }, [buckets]);

  const active = buckets[tab];

  return (
    <div>
      <div role="tablist" className="mt-4 flex gap-1 rounded-lg border border-ps-border bg-ps-surface p-1">
        <TabButton id="today" current={tab} onSelect={setTab} count={buckets.today.length}>
          Today
        </TabButton>
        <TabButton id="upcoming" current={tab} onSelect={setTab} count={buckets.upcoming.length}>
          Upcoming
        </TabButton>
        <TabButton id="results" current={tab} onSelect={setTab} count={buckets.results.length}>
          Results
        </TabButton>
      </div>

      {hasPredictions && (
        <div className="mt-3 space-y-0 rounded-lg border border-ps-border bg-ps-surface px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ps-text-sec">
              {showPredictions ? "Your predictions are shown" : "Fixtures only"}
            </span>
            <ToggleSwitch
              label={showPredictions ? "Hide picks" : "Show picks"}
              checked={showPredictions}
              onChange={() => setShowPredictions((v) => !v)}
            />
          </div>
          {showPredictions && hasResults && (
            <div className="flex items-center justify-between border-t border-ps-border/50 pt-2 mt-2">
              <span className="text-xs text-ps-text-sec">
                Show correct / wrong
              </span>
              <ToggleSwitch
                label={showCorrectness ? "On" : "Off"}
                checked={showCorrectness}
                onChange={() => setShowCorrectness((v) => !v)}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {active.length === 0 && (
          <p className="rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
            {tab === "today"
              ? "No matches today."
              : tab === "upcoming"
                ? "No upcoming matches."
                : "No results yet."}
          </p>
        )}
        {active.map((f) => (
          <FixtureCard
            key={f.externalId}
            fixture={f}
            result={resultsByExternalId[f.externalId]}
            prediction={showPredictions ? predictionsByExternalId[f.externalId] : undefined}
            showCorrectness={showPredictions && showCorrectness}
          />
        ))}
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
        "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-ps-text text-ps-bg"
          : "text-ps-text-sec hover:text-ps-text",
      ].join(" ")}
    >
      {children}
      <span
        className={[
          "ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 font-mono text-[0.7rem] tabular-nums",
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
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
    >
      {label}
      <span
        className={[
          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
          checked ? "bg-ps-amber" : "bg-ps-border",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-3 w-3 rounded-full bg-white transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5",
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
}: {
  fixture: WcFixture;
  result: FixtureResult | undefined;
  prediction: FixturePredictionData | undefined;
  showCorrectness: boolean;
}) {
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

      submitPrediction("exact_score", { home: h, away: a }).catch(() => {
        // Score save failed silently — winner was already set
      });
    },
    [canPredict, prediction, fixture.home, fixture.away, drawOption, currentWinner, handlePickWinner, submitPrediction],
  );

  // ── Derived display state ──
  const hasPrediction = currentWinner !== null || homeScore !== "" || awayScore !== "";
  const homeSelected = currentWinner === fixture.home;
  const awaySelected = currentWinner === fixture.away;
  const drawSelected = currentWinner === drawOption;

  // Ring color: green (correct), red (wrong), white (pending / correctness off)
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
            ? "ring-2 ring-ps-green"
            : "ring-2 ring-ps-red";
      } else {
        ringClass = "ring-2 ring-white/30";
      }
    } else {
      // Upcoming / pending — neutral ring
      ringClass = "ring-2 ring-white/30";
    }
  }

  const cityTime = formatTime(kickoff, city.timezone);
  const cityDate = formatDateShort(kickoff, city.timezone);
  const localTime = formatTime(kickoff, undefined);
  const localTzAbbr = formatTzAbbr(kickoff);
  const sameClock = cityTime === localTime;

  return (
    <article
      className={[
        "overflow-hidden rounded-xl text-white shadow-sm transition-all",
        ringClass,
      ].join(" ")}
      style={{ backgroundColor: city.color }}
    >
      {/* Header: stage + city/stadium */}
      <header className="flex items-center justify-between px-4 pt-3 text-[0.7rem] font-bold uppercase tracking-wide text-white/85">
        <span>
          {fixture.stage === "group"
            ? `Group ${fixture.group} · MD${fixture.matchday}`
            : stageLabel(fixture.stage)}
        </span>
        <span className="text-right">
          <span className="block">{city.name}</span>
          <span className="block text-[0.6rem] font-medium normal-case tracking-normal text-white/50">
            {city.stadium}
          </span>
        </span>
      </header>

      <div className="px-4 pb-3 pt-2">
        {/* ── Prediction row (upcoming + unlocked) ── */}
        {canPredict && (
          <>
            <div className="flex items-center justify-center gap-1.5">
              {/* Home team button */}
              <button
                type="button"
                onClick={() => handlePickWinner(fixture.home)}
                className={[
                  "flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer",
                  homeSelected
                    ? "bg-white/12 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)]"
                    : "hover:bg-white/8",
                ].join(" ")}
              >
                <CountryFlag shape="pill" name={fixture.home} size={24} />
                <span
                  className={[
                    "max-w-full truncate text-[11px] font-semibold text-center leading-tight",
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
                    "w-[30px] h-[28px] rounded-full border text-center font-mono text-sm font-semibold text-white outline-none transition-all duration-150 shrink-0",
                    homeScore !== ""
                      ? "bg-white/18 border-white/50"
                      : "bg-white/8 border-white/25",
                    "focus:border-white/60 focus:bg-white/15",
                    "placeholder:text-white/30",
                  ].join(" ")}
                />
              )}

              {/* Draw button */}
              <button
                type="button"
                onClick={() => handlePickWinner(drawOption)}
                className={[
                  "shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer",
                  drawSelected
                    ? "bg-white/12 text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)]"
                    : "text-white/45 hover:bg-white/8 hover:text-white/65",
                ].join(" ")}
              >
                draw
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
                    "w-[30px] h-[28px] rounded-full border text-center font-mono text-sm font-semibold text-white outline-none transition-all duration-150 shrink-0",
                    awayScore !== ""
                      ? "bg-white/18 border-white/50"
                      : "bg-white/8 border-white/25",
                    "focus:border-white/60 focus:bg-white/15",
                    "placeholder:text-white/30",
                  ].join(" ")}
                />
              )}

              {/* Away team button */}
              <button
                type="button"
                onClick={() => handlePickWinner(fixture.away)}
                className={[
                  "flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer",
                  awaySelected
                    ? "bg-white/12 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)]"
                    : "hover:bg-white/8",
                ].join(" ")}
              >
                <CountryFlag shape="pill" name={fixture.away} size={24} />
                <span
                  className={[
                    "max-w-full truncate text-[11px] font-semibold text-center leading-tight",
                    awaySelected ? "text-white" : "text-white/55",
                  ].join(" ")}
                >
                  {fixture.away}
                </span>
              </button>
            </div>

            {error && (
              <p className="mt-1 text-center text-[10px] font-medium text-red-300">{error}</p>
            )}
          </>
        )}

        {/* ── Read-only teams + result (finished) ── */}
        {isFinished && (
          <>
            <h3 className="flex flex-wrap items-center gap-1.5 text-base font-bold text-white">
              <CountryFlag shape="pill" name={fixture.home} size={20} />
              <span>{fixture.home}</span>
              <span className="mx-0.5 text-white/70">v</span>
              <CountryFlag shape="pill" name={fixture.away} size={20} />
              <span>{fixture.away}</span>
            </h3>
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/15 px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
              {result?.homeScore !== null && result?.awayScore !== null
                ? `${result?.homeScore} – ${result?.awayScore}`
                : (result?.winner ?? "Result")}
              <span
                className={[
                  "rounded-full px-1.5 py-px text-[0.65rem] uppercase tracking-wide",
                  result?.isFinalised ? "bg-emerald-500/90 text-white" : "bg-amber-500/90 text-white",
                ].join(" ")}
              >
                {result?.isFinalised ? "Final" : "Provisional"}
              </span>
            </div>
          </>
        )}

        {/* ── Read-only teams (upcoming but locked / no prediction context) ── */}
        {!isFinished && !canPredict && (
          <h3 className="flex flex-wrap items-center gap-1.5 text-base font-bold text-white">
            <CountryFlag shape="pill" name={fixture.home} size={20} />
            <span>{fixture.home}</span>
            <span className="mx-0.5 text-white/70">v</span>
            <CountryFlag shape="pill" name={fixture.away} size={20} />
            <span>{fixture.away}</span>
          </h3>
        )}

        {/* ── Time info (upcoming only) ── */}
        {!isFinished && (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-white/90">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-white/70">
                In {city.name.split(" ")[0]}
              </dt>
              <dd className="font-mono tabular-nums">
                {cityTime}
                <span className="ml-1 text-white/70">· {cityDate}</span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-white/70">Your time</dt>
              <dd className="font-mono tabular-nums">
                {sameClock ? "Same" : `${localTime} ${localTzAbbr}`}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}

function stageLabel(stage: WcFixture["stage"]): string {
  switch (stage) {
    case "R32": return "Round of 32";
    case "R16": return "Round of 16";
    case "QF": return "Quarter-final";
    case "SF": return "Semi-final";
    case "3RD": return "Third place";
    case "FINAL": return "Final";
    default: return stage;
  }
}

function formatTime(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function formatDateShort(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function formatTzAbbr(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
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
