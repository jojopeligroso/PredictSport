"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PickButton } from "@/components/ui/PickButton";
import { SportPill } from "@/components/ui";
import { ComboboxInput } from "@/components/ui/ComboboxInput";
import { getRaceEntrants } from "@/lib/race-entrants";
import { toSportKey } from "@/components/ui/sport-config";
import {
  ExactScoreInput,
  emptyScore,
  isScoreComplete,
  scoreToData,
  dataToScore,
  type ScoreValue,
} from "@/components/ExactScoreInput";
import { supportsExactScore, deriveWinnerFromScore } from "@/lib/score-format";
import type { NormalizedFixture } from "@/app/api/sports/fixtures/route";
import type { Sport } from "@/lib/sports/types";

// ── Sport classification ──────────────────────────────────────────────────────

const DRAW_SPORTS = new Set([
  "soccer", "rugby", "rugby_league", "gaa", "gaelic_football", "hurling", "cricket",
]);

const RACE_SPORTS = new Set([
  "formula_1", "golf", "horse_racing", "athletics",
]);

// ── League data ───────────────────────────────────────────────────────────────

interface LeagueOption {
  id: string;
  label: string;
  sport: Sport;
}

interface LeagueGroup {
  label: string;
  leagues: LeagueOption[];
}

const LEAGUE_GROUPS: LeagueGroup[] = [
  {
    label: "Soccer — England",
    leagues: [
      { id: "4328", label: "Premier League", sport: "soccer" },
      { id: "4329", label: "Championship", sport: "soccer" },
      { id: "4350", label: "League Cup", sport: "soccer" },
    ],
  },
  {
    label: "Soccer — Europe",
    leagues: [
      { id: "4480", label: "Champions League", sport: "soccer" },
      { id: "4481", label: "Europa League", sport: "soccer" },
      { id: "4335", label: "La Liga", sport: "soccer" },
      { id: "4331", label: "Bundesliga", sport: "soccer" },
      { id: "4332", label: "Serie A", sport: "soccer" },
      { id: "4334", label: "Ligue 1", sport: "soccer" },
    ],
  },
  {
    label: "Soccer — Ireland / Scotland",
    leagues: [
      { id: "4643", label: "League of Ireland Premier", sport: "soccer" },
      { id: "4757", label: "League of Ireland First Division", sport: "soccer" },
      { id: "4330", label: "Scottish Premiership", sport: "soccer" },
    ],
  },
  {
    label: "GAA",
    leagues: [
      { id: "gaa-football", label: "GAA Football", sport: "gaa" },
      { id: "gaa-hurling", label: "GAA Hurling", sport: "gaa" },
      { id: "gaa-camogie", label: "Camogie", sport: "gaa" },
    ],
  },
  {
    label: "US Sports",
    leagues: [
      { id: "4387", label: "NBA", sport: "nba" },
      { id: "4424", label: "MLB", sport: "mlb" },
      { id: "4380", label: "NHL", sport: "nhl" },
      { id: "4391", label: "NFL", sport: "nfl" },
    ],
  },
  {
    label: "Motorsport",
    leagues: [
      { id: "4370", label: "Formula 1", sport: "formula_1" },
    ],
  },
  {
    label: "Rugby",
    leagues: [
      { id: "4446", label: "United Rugby Championship", sport: "rugby" },
      { id: "4550", label: "Champions Cup", sport: "rugby" },
      { id: "4415", label: "Super League", sport: "rugby_league" },
      { id: "4416", label: "NRL", sport: "rugby_league" },
    ],
  },
  {
    label: "Tennis",
    leagues: [
      { id: "4464", label: "ATP Tour", sport: "tennis" },
      { id: "4517", label: "WTA Tour", sport: "tennis" },
    ],
  },
  {
    label: "Cricket",
    leagues: [
      { id: "4460", label: "IPL", sport: "cricket" },
      { id: "4844", label: "Test Matches", sport: "cricket" },
      { id: "4979", label: "T20 Internationals", sport: "cricket" },
      { id: "4463", label: "T20 Blast", sport: "cricket" },
      { id: "4458", label: "County Championship Div 1", sport: "cricket" },
      { id: "4459", label: "County Championship Div 2", sport: "cricket" },
      { id: "cricket-ranji", label: "Ranji Trophy", sport: "cricket" },
      { id: "cricket-sheffield-shield", label: "Sheffield Shield", sport: "cricket" },
      { id: "cricket-vitality-blast", label: "Vitality Blast", sport: "cricket" },
    ],
  },
  {
    label: "Other",
    leagues: [
      { id: "4555", label: "World Snooker", sport: "snooker" },
      { id: "4758", label: "European Tour (Golf)", sport: "golf" },
    ],
  },
];

// ── Two-level sport category picker ──────────────────────────────────────────

const SPORT_CATEGORIES: { label: string; groupLabels: string[] }[] = [
  { label: "Soccer",    groupLabels: ["Soccer — England", "Soccer — Europe", "Soccer — Ireland / Scotland"] },
  { label: "GAA",       groupLabels: ["GAA"] },
  { label: "Rugby",     groupLabels: ["Rugby"] },
  { label: "US Sports", groupLabels: ["US Sports"] },
  { label: "Motorsport",groupLabels: ["Motorsport"] },
  { label: "Tennis",    groupLabels: ["Tennis"] },
  { label: "Cricket",   groupLabels: ["Cricket"] },
  { label: "Other",     groupLabels: ["Other"] },
];

function leaguesForCategory(categoryLabel: string): LeagueOption[] {
  const cat = SPORT_CATEGORIES.find((c) => c.label === categoryLabel);
  if (!cat) return [];
  return LEAGUE_GROUPS.filter((g) => cat.groupLabels.includes(g.label)).flatMap((g) => g.leagues);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "TBC";
  return d.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "9999-99-99";
  return d.toISOString().slice(0, 10);
}

function getLeagueLabel(providerLeague: string | null): string | null {
  if (!providerLeague) return null;
  for (const group of LEAGUE_GROUPS) {
    for (const league of group.leagues) {
      if (league.id === providerLeague) return league.label;
    }
  }
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutrightPick {
  league_id: string;
  league_name: string;
  sport: string;
  pick: string | null;
  change_history: Array<{ pick: string; changed_at: string }>;
}

interface PredictionOption {
  value: string;
  label: string;
  sub?: string;
}

interface PersonalPick {
  event_id: string;
  external_event_id: string;
  event_name: string;
  sport: string;
  start_time: string;
  status: string;
  provider_league: string | null;
  result_data: Record<string, unknown> | null;
  participants: string[];
  predictions: Record<string, {
    id: string;
    data: Record<string, unknown>;
    is_correct: boolean | null;
    ept_id: string;
  }>;
  prediction_types: Array<{ id: string; prediction_type: string }>;
}

interface EventInfo {
  event_id: string;
  prediction_types: Array<{ id: string; prediction_type: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPredictionOptions(fixture: NormalizedFixture): PredictionOption[] | null {
  const [home, away] = fixture.participants;

  if (RACE_SPORTS.has(fixture.sport)) {
    if (fixture.participants.length >= 2) {
      return fixture.participants.slice(0, 6).map((p) => ({ value: p, label: p }));
    }
    return null;
  }

  if (!home || !away) return null;

  if (DRAW_SPORTS.has(fixture.sport)) {
    return [
      { value: home, label: home, sub: "Home" },
      { value: "Draw", label: "Draw" },
      { value: away, label: away, sub: "Away" },
    ];
  }

  return [
    { value: home, label: home, sub: "Home" },
    { value: away, label: away, sub: "Away" },
  ];
}

function formatScoreDisplay(data: Record<string, unknown>, sport: string): string {
  if (sport === "gaa" || sport === "gaelic_football" || sport === "hurling") {
    const home = data.home as Record<string, number> | undefined;
    const away = data.away as Record<string, number> | undefined;
    if (home && away) {
      return `${home.goals}-${home.points} v ${away.goals}-${away.points}`;
    }
  }
  if (data.home !== undefined && data.away !== undefined) {
    return `${data.home} - ${data.away}`;
  }
  return JSON.stringify(data);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function FixtureSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-ps-border bg-ps-surface p-4">
      <div className="mb-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-ps-border" />
        <div className="h-3 w-1/2 rounded bg-ps-border" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded-lg bg-ps-border" />
        <div className="h-10 rounded-lg bg-ps-border" />
        <div className="h-10 rounded-lg bg-ps-border" />
      </div>
    </div>
  );
}

// ── Pick row (My Picks tab) ───────────────────────────────────────────────────

function PickRow({
  pick,
  showResultHints,
  isExpanded,
  onToggle,
  onSave,
  isSaving,
}: {
  pick: PersonalPick;
  showResultHints: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (fixture: NormalizedFixture, value: string) => void;
  isSaving: boolean;
}) {
  const winnerPick = (pick.predictions.winner?.data.value as string) ?? "";
  const scorePrediction = pick.predictions.exact_score?.data ?? null;
  const resultValue = (pick.result_data?.winner as string) ?? null;
  const isCorrect = pick.predictions.winner?.is_correct ?? null;
  const scoreCorrect = pick.predictions.exact_score?.is_correct ?? null;

  const [raceInput, setRaceInput] = useState(winnerPick);
  const participants = pick.participants;
  const [home, away] = participants;
  const hasTeams = Boolean(home && away);
  const isPast = new Date(pick.start_time) <= new Date();
  const hasResult = resultValue !== null && isCorrect !== null;
  const leagueLabel = getLeagueLabel(pick.provider_league);

  const pseudoFixture: NormalizedFixture = {
    external_event_id: pick.external_event_id,
    event_name: pick.event_name,
    sport: pick.sport as Sport,
    competition_name: leagueLabel ?? "",
    participants: pick.participants,
    start_time: pick.start_time,
    round: null,
    season: null,
    provider_league: pick.provider_league,
  };

  const options = getPredictionOptions(pseudoFixture);
  const isRace = RACE_SPORTS.has(pick.sport);

  return (
    <div
      className={`rounded-xl border bg-ps-surface transition-colors ${
        isPast && showResultHints && hasResult
          ? isCorrect
            ? "border-ps-green/40"
            : "border-ps-border"
          : isPast
            ? "border-ps-border"
            : "border-ps-amber/35"
      }`}
    >
      {/* Header row — always visible, tappable */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Left: event info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-ps-text">
            {hasTeams ? `${home} vs ${away}` : pick.event_name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-ps-text-ter">
              {formatTime(pick.start_time)}
            </span>
            <SportPill sport={toSportKey(pick.sport as Sport)} size="sm" />
            {leagueLabel && (
              <span className="max-w-[100px] truncate rounded-full bg-ps-chip px-1.5 py-px text-[10px] font-semibold text-ps-text-ter">
                {leagueLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right: pick + result + chevron */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-extrabold text-ps-text">{winnerPick}</p>
            {scorePrediction && (
              <p className="mt-0.5 font-mono text-[10px] text-ps-amber-deep">
                {formatScoreDisplay(scorePrediction, pick.sport)}
                {scoreCorrect !== null && (
                  <span className={`ml-1 font-bold ${scoreCorrect ? "text-ps-green" : "text-ps-red"}`}>
                    {scoreCorrect ? "\u2713" : "\u2717"}
                  </span>
                )}
              </p>
            )}
            {isPast && showResultHints && hasResult ? (
              <span
                className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  isCorrect
                    ? "bg-ps-green-soft text-ps-green"
                    : "bg-ps-red/10 text-ps-red"
                }`}
              >
                {isCorrect ? "Correct" : "Wrong"}
              </span>
            ) : isPast && resultValue !== null ? (
              <p className="mt-0.5 text-[10px] font-semibold text-ps-text-ter">
                Result: {resultValue}
              </p>
            ) : null}
          </div>
          {!isPast && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className={`shrink-0 text-ps-text-ter transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded: change pick area */}
      {isExpanded && !isPast && (
        <div className="border-t border-ps-border/50 px-4 pb-4 pt-3">
          <p className="mb-2 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Change pick
          </p>
          {options !== null ? (
            <div
              className={`grid gap-2 ${
                options.length === 3
                  ? "grid-cols-3"
                  : options.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {options.map((opt) => (
                <PickButton
                  key={opt.value}
                  label={opt.label}
                  sub={opt.sub}
                  selected={winnerPick === opt.value}
                  disabled={isSaving}
                  onClick={() => onSave(pseudoFixture, opt.value)}
                />
              ))}
            </div>
          ) : isRace ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={raceInput}
                onChange={(e) => setRaceInput(e.target.value)}
                className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/40"
              />
              <button
                type="button"
                onClick={() => onSave(pseudoFixture, raceInput)}
                disabled={isSaving || !raceInput.trim()}
                className="rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-2 text-xs font-extrabold text-[#1a1208] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Inline score input for personal predictions ─────────────────────────────

function PersonalScoreInput({
  fixture,
  existingScore,
  currentPick,
  isSaving,
  onSaveWithScore,
}: {
  fixture: NormalizedFixture;
  existingScore: Record<string, unknown> | null;
  currentPick: string | undefined;
  isSaving: boolean;
  onSaveWithScore: (fixture: NormalizedFixture, value: string, score: Record<string, unknown> | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(existingScore !== null);
  const [score, setScore] = useState<ScoreValue>(() =>
    dataToScore(existingScore, fixture.sport)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [home, away] = fixture.participants;
  if (!home || !away) return null;

  const winnerOptions = [home, away];
  const handleSave = async () => {
    if (!isScoreComplete(score, fixture.sport)) return;
    const scoreData = scoreToData(score, fixture.sport);
    if (!scoreData) return;

    setIsSubmitting(true);
    const implied = deriveWinnerFromScore(scoreData, fixture.sport, winnerOptions);
    const predValue = implied ?? currentPick ?? home;
    onSaveWithScore(fixture, predValue, scoreData);
    setIsSubmitting(false);
  };

  const handleClear = () => {
    setScore(emptyScore(fixture.sport));
    setIsExpanded(false);
    if (currentPick) {
      onSaveWithScore(fixture, currentPick, null);
    }
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ps-amber-deep transition-colors hover:text-ps-amber"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Predict exact score
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-ps-amber/25 bg-ps-amber-soft p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ps-amber-deep">
          Exact Score
        </span>
      </div>

      <ExactScoreInput
        sport={fixture.sport}
        homeTeam={home}
        awayTeam={away}
        value={score}
        onChange={setScore}
        disabled={isSaving || isSubmitting}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isSubmitting || !isScoreComplete(score, fixture.sport)}
          className="rounded-lg bg-ps-text px-3 py-1.5 text-xs font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : existingScore ? "Update" : "Save"}
        </button>
        {existingScore ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving || isSubmitting}
            className="rounded-lg border border-ps-border px-3 py-1.5 text-xs font-medium text-ps-text-sec transition-colors hover:border-ps-red hover:text-ps-red disabled:opacity-50"
          >
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setScore(emptyScore(fixture.sport));
              setIsExpanded(false);
            }}
            disabled={isSaving || isSubmitting}
            className="text-xs font-medium text-ps-text-ter hover:text-ps-text-sec"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── My Picks tab content ──────────────────────────────────────────────────────

function MyPicksTab({
  picks,
  showResultHints,
  saving,
  onSave,
}: {
  picks: PersonalPick[];
  showResultHints: boolean;
  saving: Record<string, boolean>;
  onSave: (fixture: NormalizedFixture, value: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const now = new Date();

  const upcomingPicks = useMemo(
    () =>
      picks
        .filter((p) => new Date(p.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picks]
  );

  const pastPicks = useMemo(
    () =>
      picks
        .filter((p) => new Date(p.start_time) <= now)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picks]
  );

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (picks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-14 text-center">
        <p className="text-sm font-bold text-ps-text-sec">No picks yet</p>
        <p className="mt-1 text-xs text-ps-text-ter">
          Head to Fixtures to make your first prediction.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {upcomingPicks.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Coming up
          </p>
          <div className="flex flex-col gap-2">
            {upcomingPicks.map((pick) => (
              <PickRow
                key={pick.external_event_id}
                pick={pick}
                showResultHints={showResultHints}
                isExpanded={expandedId === pick.external_event_id}
                onToggle={() => toggleExpanded(pick.external_event_id)}
                onSave={onSave}
                isSaving={saving[pick.external_event_id] ?? false}
              />
            ))}
          </div>
        </div>
      )}

      {pastPicks.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Past picks
          </p>
          <div className="flex flex-col gap-2">
            {pastPicks.map((pick) => (
              <PickRow
                key={pick.external_event_id}
                pick={pick}
                showResultHints={showResultHints}
                isExpanded={false}
                onToggle={() => {}}
                onSave={onSave}
                isSaving={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outrights tab content ─────────────────────────────────────────────────────

interface OutrightEntry {
  event_id: string;
  league_id: string | null;
  league_name: string;
  sport: string;
  pick: string | null;
  change_history: { pick: string; changed_at: string }[];
  is_correct: boolean | null;
  status: string;
  result_data: Record<string, unknown> | null;
}

type OutrightStatus = "open" | "pending" | "resolved";

function classifyOutright(o: OutrightEntry): OutrightStatus {
  if (o.is_correct === true || o.is_correct === false) return "resolved";
  if (o.result_data && o.is_correct === null) return "pending";
  return "open";
}

const STATUS_LABEL: Record<OutrightStatus, string> = {
  open: "Open",
  pending: "Pending Resolution",
  resolved: "Resolved",
};

function OutrightsTab() {
  const [outrights, setOutrights] = useState<OutrightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/personal-predictions/outrights");
        if (!res.ok) throw new Error(`Failed to load outrights (${res.status})`);
        const data = await res.json();
        if (!cancelled) setOutrights(data.outrights ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-14 text-center">
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-ps-amber border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-ps-red/30 bg-ps-red/10 px-4 py-3 text-sm font-semibold text-ps-red">
        {error}
      </div>
    );
  }

  if (outrights.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-14 text-center">
        <p className="text-sm font-bold text-ps-text-sec">No outrights yet</p>
        <p className="mt-1 text-xs text-ps-text-ter">
          Browse fixtures and pick who wins a league or tournament.
        </p>
      </div>
    );
  }

  // Group by status
  const grouped = new Map<OutrightStatus, OutrightEntry[]>();
  for (const o of outrights) {
    const s = classifyOutright(o);
    if (!grouped.has(s)) grouped.set(s, []);
    grouped.get(s)!.push(o);
  }

  const ORDER: OutrightStatus[] = ["open", "pending", "resolved"];

  return (
    <div className="flex flex-col gap-5">
      {ORDER.filter((s) => grouped.has(s)).map((status) => (
        <div key={status}>
          <p className="mb-2 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            {STATUS_LABEL[status]}
          </p>
          <div className="flex flex-col gap-2">
            {grouped.get(status)!.map((o) => (
              <OutrightCard key={o.event_id} outright={o} status={status} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OutrightCard({
  outright,
  status,
}: {
  outright: OutrightEntry;
  status: OutrightStatus;
}) {
  const borderClass =
    status === "resolved"
      ? outright.is_correct
        ? "border-ps-green/40"
        : "border-ps-border"
      : status === "pending"
        ? "border-ps-amber/40"
        : "border-ps-border";

  const changesUsed = Math.max(0, outright.change_history.length - 1);
  const resultWinner = outright.result_data?.winner as string | undefined;

  return (
    <div className={`rounded-xl border bg-ps-surface px-4 py-3 ${borderClass}`}>
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        {status === "resolved" && (
          <div
            className={`mt-0.5 shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              outright.is_correct
                ? "bg-ps-green-soft text-ps-green"
                : "bg-ps-red/10 text-ps-red"
            }`}
          >
            {outright.is_correct ? "W" : "L"}
          </div>
        )}
        {status === "pending" && (
          <div className="mt-0.5 shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-ps-amber/15 text-[10px] font-extrabold text-ps-amber">
            ?
          </div>
        )}
        {status === "open" && (
          <div className="mt-0.5 shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-ps-chip text-[10px] font-extrabold text-ps-text-ter">
            &bull;
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ps-text">{outright.league_name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <SportPill sport={toSportKey(outright.sport as Sport)} size="sm" />
            {changesUsed > 0 && (
              <span className="font-mono text-[10px] text-ps-text-ter">
                {changesUsed} change{changesUsed !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Pick / result */}
        <div className="shrink-0 text-right">
          <p className="text-xs font-extrabold text-ps-text">{outright.pick ?? "No pick"}</p>
          {resultWinner && (
            <p className="mt-0.5 text-[10px] font-semibold text-ps-text-ter">
              Winner: {resultWinner}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Results tab content ───────────────────────────────────────────────────────

function ResultsTab({ picks }: { picks: PersonalPick[] }) {
  const settled = useMemo(
    () =>
      picks
        .filter((p) => p.predictions.winner?.is_correct !== undefined && p.predictions.winner?.is_correct !== null)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    [picks]
  );

  const correct = settled.filter((p) => p.predictions.winner?.is_correct === true).length;

  if (settled.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-14 text-center">
        <p className="text-sm font-bold text-ps-text-sec">No results yet</p>
        <p className="mt-1 text-xs text-ps-text-ter">
          Results appear here once fixtures are confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex flex-col rounded-xl border border-ps-border bg-ps-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
              Record
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-ps-text">
              {correct} / {settled.length} correct
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
              Hit rate
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-ps-text">
              {Math.round((correct / settled.length) * 100)}%
            </p>
          </div>
        </div>
        {/* Hit rate bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-ps-chip overflow-hidden">
          <div
            className="h-full rounded-full bg-ps-green transition-all"
            style={{ width: `${Math.round((correct / settled.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Results list */}
      <div className="flex flex-col gap-2">
        {settled.map((pick) => {
          const participants = pick.participants;
          const [home, away] = participants;
          const hasTeams = Boolean(home && away);
          const pickLabel = (pick.predictions.winner?.data.value as string) ?? "Unknown";
          const resultLabel = (pick.result_data?.winner as string) ?? "Unknown";
          const isCorrect = pick.predictions.winner?.is_correct === true;
          const scorePrediction = pick.predictions.exact_score?.data ?? null;
          const scoreCorrect = pick.predictions.exact_score?.is_correct ?? null;

          return (
            <div
              key={pick.external_event_id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-ps-surface ${
                isCorrect ? "border-ps-green/40" : "border-ps-border"
              }`}
            >
              {/* Outcome indicator */}
              <div
                className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  isCorrect
                    ? "bg-ps-green-soft text-ps-green"
                    : "bg-ps-red/10 text-ps-red"
                }`}
              >
                {isCorrect ? "W" : "L"}
              </div>

              {/* Event info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ps-text">
                  {hasTeams ? `${home} vs ${away}` : pick.event_name}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-ps-text-ter">
                    {formatTime(pick.start_time)}
                  </span>
                  <SportPill sport={toSportKey(pick.sport as Sport)} size="sm" />
                </div>
              </div>

              {/* Pick vs Result */}
              <div className="shrink-0 text-right">
                <p className="text-xs font-extrabold text-ps-text">{pickLabel}</p>
                {scorePrediction && (
                  <p className="mt-0.5 font-mono text-[10px] text-ps-amber-deep">
                    {formatScoreDisplay(scorePrediction, pick.sport)}
                    {scoreCorrect !== null && (
                      <span className={`ml-1 font-bold ${scoreCorrect ? "text-ps-green" : "text-ps-red"}`}>
                        {scoreCorrect ? "\u2713" : "\u2717"}
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] font-semibold text-ps-text-ter">
                  Result: {resultLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Outright card (contextual, Fixtures tab) ─────────────────────────────────

function ContextualOutrightCard({
  leagueId,
  leagueName,
  sport,
  existingOutright,
  onSave,
}: {
  leagueId: string;
  leagueName: string;
  sport: string;
  existingOutright: OutrightPick | undefined;
  onSave: (leagueId: string, leagueName: string, sport: string, pick: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickInput, setPickInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Reset expansion when league changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on prop change
    setIsExpanded(false);
    setPickInput("");
    setIsEditing(false);
  }, [leagueId]);

  const handleSubmit = async () => {
    if (!pickInput.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(leagueId, leagueName, sport, pickInput.trim());
      setIsExpanded(false);
      setIsEditing(false);
      setPickInput("");
    } finally {
      setIsSaving(false);
    }
  };

  // Already has an outright pick
  if (existingOutright?.pick && !isEditing) {
    return (
      <div className="mb-4 rounded-2xl border border-ps-amber/30 bg-ps-amber-soft p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-amber-deep">
              Outright Winner
            </p>
            <p className="mt-1 text-sm font-extrabold text-ps-text">
              {existingOutright.pick}
            </p>
            <p className="mt-0.5 text-[11px] text-ps-text-ter">
              Your pick for {leagueName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setPickInput(existingOutright.pick ?? "");
            }}
            className="shrink-0 rounded-lg border border-ps-border px-3 py-1.5 text-xs font-semibold text-ps-text-sec transition-colors hover:border-ps-amber hover:text-ps-text"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  // Editing existing or creating new
  if (isExpanded || isEditing) {
    return (
      <div className="mb-4 rounded-2xl border border-ps-amber/30 bg-ps-amber-soft p-4">
        <p className="text-sm font-extrabold text-ps-text">
          Who wins {leagueName}?
        </p>
        <p className="mt-1 text-[11px] text-ps-text-ter">
          Make your outright prediction for the season
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={pickInput}
            onChange={(e) => setPickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Team or player name..."
            className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/40"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !pickInput.trim()}
            className="rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2 text-xs font-extrabold text-[#1a1208] disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Lock it in"}
          </button>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setPickInput("");
            }}
            className="mt-2 text-xs font-medium text-ps-text-ter hover:text-ps-text-sec"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // Prompt card — tap to expand
  return (
    <button
      type="button"
      onClick={() => setIsExpanded(true)}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-ps-amber/40 bg-ps-amber-soft/50 p-4 text-left transition-colors hover:border-ps-amber/60 hover:bg-ps-amber-soft"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-amber/20 text-ps-amber-deep">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-ps-text">
          Who wins {leagueName}?
        </p>
        <p className="mt-0.5 text-[11px] text-ps-text-ter">
          Tap to make your outright prediction
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ps-text-ter">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PersonalFixtureBrowser({
  showResultHints = true,
  defaultSport = "Soccer",
}: {
  showResultHints?: boolean;
  defaultSport?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Restore sport/league: URL params -> sessionStorage -> user default
  const urlSport = searchParams.get("sport");
  const urlLeague = searchParams.get("league");

  const [activeTab, setActiveTab] = useState<"fixtures" | "my-picks" | "outrights" | "results">("fixtures");
  const [selectedSport, setSelectedSport] = useState<string>(() => {
    if (urlSport && SPORT_CATEGORIES.some((c) => c.label === urlSport)) return urlSport;
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("ps-selected-sport");
      if (stored && SPORT_CATEGORIES.some((c) => c.label === stored)) return stored;
    }
    return defaultSport;
  });
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(() => {
    const sport = (() => {
      if (urlSport && SPORT_CATEGORIES.some((c) => c.label === urlSport)) return urlSport;
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("ps-selected-sport");
        if (stored && SPORT_CATEGORIES.some((c) => c.label === stored)) return stored;
      }
      return defaultSport;
    })();
    const leagues = leaguesForCategory(sport);
    if (urlLeague && leagues.some((l) => l.id === urlLeague)) return urlLeague;
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("ps-selected-league");
      if (stored && leagues.some((l) => l.id === stored)) return stored;
    }
    return leagues[0]?.id ?? leaguesForCategory("Soccer")[0]!.id;
  });
  const [fixtures, setFixtures] = useState<NormalizedFixture[]>([]);
  const [picks, setPicks] = useState<PersonalPick[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [getError, setGetError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [raceInputs, setRaceInputs] = useState<Record<string, string>>({});

  const [outrights, setOutrights] = useState<Map<string, OutrightPick>>(new Map());
  const [showAllLeagues, setShowAllLeagues] = useState(false);
  const currentLeagues = useMemo(() => leaguesForCategory(selectedSport), [selectedSport]);

  // Event cache: maps external_event_id -> { event_id, prediction_types }
  // Populated from list endpoint and B2 calls. Avoids redundant B2 requests.
  const eventCacheRef = useRef<Record<string, EventInfo>>({});

  const pickMap = useMemo(() => {
    const map: Record<string, PersonalPick> = {};
    for (const p of picks) {
      map[p.external_event_id] = p;
    }
    return map;
  }, [picks]);

  function selectSport(label: string) {
    setSelectedSport(label);
    setShowAllLeagues(false);
    sessionStorage.setItem("ps-selected-sport", label);
    const first = leaguesForCategory(label)[0];
    if (first) {
      setSelectedLeagueId(first.id);
      sessionStorage.setItem("ps-selected-league", first.id);
      router.replace(
        `${pathname}?sport=${encodeURIComponent(label)}&league=${encodeURIComponent(first.id)}`,
        { scroll: false }
      );
    }
  }

  function selectLeague(id: string) {
    setSelectedLeagueId(id);
    sessionStorage.setItem("ps-selected-league", id);
    router.replace(
      `${pathname}?sport=${encodeURIComponent(selectedSport)}&league=${encodeURIComponent(id)}`,
      { scroll: false }
    );
  }

  // Ensure event exists in personal competition (B2), with caching
  const ensureEvent = useCallback(async (fixture: NormalizedFixture): Promise<EventInfo> => {
    const cached = eventCacheRef.current[fixture.external_event_id];
    if (cached) return cached;

    const res = await fetch("/api/personal-predictions/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_event_id: fixture.external_event_id,
        event_name: fixture.event_name,
        sport: fixture.sport,
        start_time: fixture.start_time,
        participants: fixture.participants,
        provider_league: fixture.provider_league,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Failed to create event");
    }

    const data = (await res.json()) as {
      event_id: string;
      prediction_types: Array<{ id: string; prediction_type: string }>;
    };
    const info: EventInfo = {
      event_id: data.event_id,
      prediction_types: data.prediction_types.map((pt) => ({
        id: pt.id,
        prediction_type: pt.prediction_type,
      })),
    };
    eventCacheRef.current[fixture.external_event_id] = info;
    return info;
  }, []);

  // Load all personal predictions from unified model on mount
  useEffect(() => {
    fetch("/api/personal-predictions/list")
      .then(async (r) => {
        const d = (await r.json()) as { events?: PersonalPick[]; error?: string };
        if (!r.ok || d.error) {
          setGetError(d.error ?? "Failed to load your predictions");
          return;
        }
        const loadedPicks = d.events ?? [];
        setPicks(loadedPicks);
        for (const pick of loadedPicks) {
          eventCacheRef.current[pick.external_event_id] = {
            event_id: pick.event_id,
            prediction_types: pick.prediction_types,
          };
        }
      })
      .catch(() => setGetError("Failed to load your predictions — check your connection"));
  }, []);

  // Load existing outrights on mount
  useEffect(() => {
    fetch("/api/personal-predictions/outrights")
      .then(async (r) => {
        const d = (await r.json()) as {
          outrights?: Array<{
            league_id: string;
            league_name: string;
            sport: string;
            pick: string | null;
            change_history: Array<{ pick: string; changed_at: string }>;
          }>;
        };
        const map = new Map<string, OutrightPick>();
        for (const o of d.outrights ?? []) {
          if (o.league_id) map.set(o.league_id, o);
        }
        setOutrights(map);
      })
      .catch(() => {
        // Non-critical — card just won't show existing picks
      });
  }, []);

  // Derive current league metadata
  const currentLeagueInfo = (() => {
    for (const group of LEAGUE_GROUPS) {
      for (const league of group.leagues) {
        if (league.id === selectedLeagueId) {
          return { label: league.label, sport: league.sport };
        }
      }
    }
    return null;
  })();

  // Save outright prediction
  const saveOutright = useCallback(async (
    leagueId: string,
    leagueName: string,
    sport: string,
    pick: string,
  ) => {
    const res = await fetch("/api/personal-predictions/outrights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        league_id: leagueId,
        league_name: leagueName,
        sport,
        pick,
        tournament_started: false,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Failed to save outright");
    }

    // Update local state
    setOutrights((prev) => {
      const next = new Map(prev);
      const existing = next.get(leagueId);
      next.set(leagueId, {
        league_id: leagueId,
        league_name: leagueName,
        sport,
        pick,
        change_history: [
          ...(existing?.change_history ?? []),
          { pick, changed_at: new Date().toISOString() },
        ],
      });
      return next;
    });
  }, []);

  // Load upcoming fixtures when league changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset before async fetch
    setLoading(true);
    setLoadError(null);
    setFixtures([]);
    fetch(`/api/sports/fixtures?league=${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error as string);
        else setFixtures((d.fixtures as NormalizedFixture[]) ?? []);
      })
      .catch(() => setLoadError("Failed to load fixtures"))
      .finally(() => setLoading(false));
  }, [selectedLeagueId]);

  const savePrediction = useCallback(async (fixture: NormalizedFixture, value: string) => {
    if (!value.trim()) return;
    setSaveError(null);
    setSaving((s) => ({ ...s, [fixture.external_event_id]: true }));

    const prevPicks = picks;
    const existing = pickMap[fixture.external_event_id];

    // Optimistic update
    setPicks((prev) => {
      const without = prev.filter((p) => p.external_event_id !== fixture.external_event_id);
      return [
        ...without,
        {
          event_id: existing?.event_id ?? "",
          external_event_id: fixture.external_event_id,
          event_name: fixture.event_name,
          sport: fixture.sport,
          start_time: fixture.start_time,
          status: "upcoming",
          provider_league: fixture.provider_league ?? null,
          result_data: null,
          participants: fixture.participants.filter((p) => p !== "Draw"),
          predictions: {
            ...(existing?.predictions.exact_score ? { exact_score: existing.predictions.exact_score } : {}),
            winner: {
              id: existing?.predictions.winner?.id ?? "",
              data: { value },
              is_correct: null,
              ept_id: existing?.predictions.winner?.ept_id ?? "",
            },
          },
          prediction_types: existing?.prediction_types ?? [],
        },
      ];
    });

    try {
      const eventInfo = await ensureEvent(fixture);
      const res = await fetch("/api/personal-predictions/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventInfo.event_id,
          prediction_type: "winner",
          prediction_data: { value },
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setSaveError(err.error ?? "Failed to save");
        setPicks(prevPicks);
      }
    } catch {
      setSaveError("Failed to save prediction");
      setPicks(prevPicks);
    } finally {
      setSaving((s) => ({ ...s, [fixture.external_event_id]: false }));
    }
  }, [picks, pickMap, ensureEvent]);

  const savePredictionWithScore = useCallback(async (
    fixture: NormalizedFixture,
    value: string,
    scorePrediction: Record<string, unknown> | null
  ) => {
    if (!value.trim()) return;
    setSaveError(null);
    setSaving((s) => ({ ...s, [fixture.external_event_id]: true }));

    const prevPicks = picks;
    const existing = pickMap[fixture.external_event_id];

    // Optimistic update
    setPicks((prev) => {
      const without = prev.filter((p) => p.external_event_id !== fixture.external_event_id);
      return [
        ...without,
        {
          event_id: existing?.event_id ?? "",
          external_event_id: fixture.external_event_id,
          event_name: fixture.event_name,
          sport: fixture.sport,
          start_time: fixture.start_time,
          status: "upcoming",
          provider_league: fixture.provider_league ?? null,
          result_data: null,
          participants: fixture.participants.filter((p) => p !== "Draw"),
          predictions: {
            winner: {
              id: existing?.predictions.winner?.id ?? "",
              data: { value },
              is_correct: null,
              ept_id: existing?.predictions.winner?.ept_id ?? "",
            },
            ...(scorePrediction ? {
              exact_score: {
                id: existing?.predictions.exact_score?.id ?? "",
                data: scorePrediction,
                is_correct: null,
                ept_id: existing?.predictions.exact_score?.ept_id ?? "",
              },
            } : {}),
          },
          prediction_types: existing?.prediction_types ?? [],
        },
      ];
    });

    try {
      const eventInfo = await ensureEvent(fixture);

      // Save winner prediction
      const winnerRes = await fetch("/api/personal-predictions/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventInfo.event_id,
          prediction_type: "winner",
          prediction_data: { value },
        }),
      });

      if (!winnerRes.ok) {
        const err = (await winnerRes.json()) as { error?: string };
        setSaveError(err.error ?? "Failed to save");
        setPicks(prevPicks);
        return;
      }

      // Save or clear exact score
      if (scorePrediction) {
        const scoreRes = await fetch("/api/personal-predictions/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventInfo.event_id,
            prediction_type: "exact_score",
            prediction_data: scorePrediction,
          }),
        });

        if (!scoreRes.ok) {
          const err = (await scoreRes.json()) as { error?: string };
          setSaveError(err.error ?? "Failed to save score");
          setPicks(prevPicks);
        }
      } else {
        // Clear exact score prediction
        await fetch("/api/personal-predictions/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventInfo.event_id,
            prediction_type: "exact_score",
            prediction_data: { _clear: true },
          }),
        });
      }
    } catch {
      setSaveError("Failed to save prediction");
      setPicks(prevPicks);
    } finally {
      setSaving((s) => ({ ...s, [fixture.external_event_id]: false }));
    }
  }, [picks, pickMap, ensureEvent]);

  // Group upcoming fixtures by date
  const grouped = useMemo(() => {
    const map = new Map<string, NormalizedFixture[]>();
    for (const f of fixtures) {
      const key = dateKey(f.start_time);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fixtures]);

  const now = new Date();

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-ps-border">
        <TabButton
          label="Fixtures"
          active={activeTab === "fixtures"}
          onClick={() => setActiveTab("fixtures")}
        />
        <TabButton
          label="My Picks"
          active={activeTab === "my-picks"}
          count={picks.length}
          onClick={() => setActiveTab("my-picks")}
        />
        <TabButton
          label="Outrights"
          active={activeTab === "outrights"}
          onClick={() => setActiveTab("outrights")}
        />
        <TabButton
          label="Results"
          active={activeTab === "results"}
          count={picks.filter((p) => p.predictions.winner?.is_correct !== undefined && p.predictions.winner?.is_correct !== null).length}
          onClick={() => setActiveTab("results")}
        />
      </div>

      {/* Errors (always visible) */}
      {getError && (
        <div className="mb-4 rounded-xl border border-ps-red/30 bg-ps-red/10 px-4 py-3 text-sm font-semibold text-ps-red">
          {getError}
        </div>
      )}

      {/* My Picks tab */}
      {activeTab === "my-picks" && (
        <MyPicksTab
          picks={picks}
          showResultHints={showResultHints}
          saving={saving}
          onSave={savePrediction}
        />
      )}

      {/* Outrights tab */}
      {activeTab === "outrights" && <OutrightsTab />}

      {/* Results tab */}
      {activeTab === "results" && <ResultsTab picks={picks} />}

      {/* Fixtures tab */}
      {activeTab === "fixtures" && (
        <div>
          {/* Sport category pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => selectSport(cat.label)}
                className={
                  selectedSport === cat.label
                    ? "rounded-full bg-ps-amber px-3 py-1 text-xs font-extrabold text-[#1a1208]"
                    : "rounded-full bg-ps-chip px-3 py-1 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* League pills */}
          {(() => {
            const LIMIT = 6;
            const hasMore = currentLeagues.length > LIMIT;
            const hiddenCount = currentLeagues.length - LIMIT;
            const visibleLeagues = showAllLeagues
              ? currentLeagues
              : [
                  ...currentLeagues.slice(0, LIMIT),
                  // always surface the selected league if it's beyond the fold
                  ...currentLeagues.slice(LIMIT).filter((l) => l.id === selectedLeagueId),
                ];
            return (
              <div className="mb-5 flex flex-wrap gap-2">
                {visibleLeagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => selectLeague(league.id)}
                    className={
                      selectedLeagueId === league.id
                        ? "rounded-lg border border-ps-amber bg-ps-amber/10 px-3 py-1.5 text-xs font-extrabold text-ps-text"
                        : "rounded-lg border border-ps-border bg-ps-surface px-3 py-1.5 text-xs font-semibold text-ps-text-sec transition-colors hover:border-ps-text-ter hover:text-ps-text"
                    }
                  >
                    {league.label}
                  </button>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShowAllLeagues((v) => !v)}
                    className="rounded-lg border border-ps-border bg-ps-surface px-3 py-1.5 text-xs font-semibold text-ps-text-ter transition-colors hover:border-ps-text-ter hover:text-ps-text-sec"
                  >
                    {showAllLeagues ? "Less" : `+${hiddenCount} more`}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Contextual outright card */}
          {currentLeagueInfo && (
            <ContextualOutrightCard
              leagueId={selectedLeagueId}
              leagueName={currentLeagueInfo.label}
              sport={currentLeagueInfo.sport}
              existingOutright={outrights.get(selectedLeagueId)}
              onSave={saveOutright}
            />
          )}

          {/* Save error */}
          {saveError && (
            <div className="mb-4 rounded-xl border border-ps-red/30 bg-ps-red/10 px-4 py-3 text-sm font-semibold text-ps-red">
              {saveError}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-3">
              <FixtureSkeleton />
              <FixtureSkeleton />
              <FixtureSkeleton />
            </div>
          )}

          {/* Load error */}
          {!loading && loadError && (
            <div className="py-8 text-center text-sm font-semibold text-ps-text-ter">
              {loadError}
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadError && fixtures.length === 0 && (
            <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-12 text-center">
              <p className="text-sm font-semibold text-ps-text-sec">No upcoming fixtures</p>
              <p className="mt-1 text-xs text-ps-text-ter">Try a different league</p>
            </div>
          )}

          {/* Fixture list grouped by date */}
          <div className="flex flex-col gap-6">
            {grouped.map(([dateStr, dayFixtures]) => (
              <div key={dateStr}>
                <p className="mb-3 text-[11px] font-extrabold tracking-widest uppercase text-ps-text-ter">
                  {formatDateHeading(dayFixtures[0]!.start_time)}
                </p>
                <div className="flex flex-col gap-3">
                  {dayFixtures.map((fixture) => {
                    const options = getPredictionOptions(fixture);
                    const pick = pickMap[fixture.external_event_id];
                    const currentPickValue = (pick?.predictions.winner?.data.value as string) ?? undefined;
                    const existingScore = pick?.predictions.exact_score?.data ?? null;
                    const isSaving = saving[fixture.external_event_id] ?? false;
                    const isRace = RACE_SPORTS.has(fixture.sport);
                    const isLocked = new Date(fixture.start_time) <= now;
                    const [home, away] = fixture.participants;
                    const hasTeams = Boolean(home && away);

                    return (
                      <div
                        key={fixture.external_event_id}
                        className={`rounded-2xl border bg-ps-surface p-4 shadow-[0_1px_2px_rgba(40,30,20,0.04)] transition-colors ${
                          currentPickValue ? "border-ps-amber/40" : "border-ps-border"
                        }`}
                      >
                        {/* Header row */}
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {hasTeams ? (
                              <p className="text-sm font-bold leading-snug text-ps-text">
                                {home}{" "}
                                <span className="text-xs font-normal text-ps-text-ter">vs</span>{" "}
                                {away}
                              </p>
                            ) : (
                              <p className="text-sm font-bold leading-snug text-ps-text">
                                {fixture.event_name}
                              </p>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] text-ps-text-ter">
                                {formatTime(fixture.start_time)}
                              </span>
                              <SportPill sport={toSportKey(fixture.sport)} size="sm" />
                              {fixture.competition_name && (
                                <span className="max-w-[140px] truncate rounded-full bg-ps-chip px-1.5 py-px text-[10px] font-semibold text-ps-text-ter">
                                  {fixture.competition_name}
                                </span>
                              )}
                              {currentPickValue && (
                                <span className="rounded-full bg-ps-green-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ps-green">
                                  Picked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prediction area */}
                        {isLocked ? (
                          currentPickValue ? (
                            <div className="flex items-center gap-1.5">
                              <LockIcon />
                              <span className="text-[11px] font-semibold text-ps-text-sec">
                                Your pick:{" "}
                                <span className="font-extrabold text-ps-text">{currentPickValue}</span>
                              </span>
                            </div>
                          ) : (
                            <p className="text-[11px] font-semibold text-ps-text-ter">
                              Fixture started — no pick made
                            </p>
                          )
                        ) : options !== null ? (
                          <div
                            className={`grid gap-2 ${
                              options.length === 3
                                ? "grid-cols-3"
                                : options.length === 2
                                ? "grid-cols-2"
                                : "grid-cols-2 sm:grid-cols-3"
                            }`}
                          >
                            {options.map((opt) => (
                              <PickButton
                                key={opt.value}
                                label={opt.label}
                                sub={opt.sub}
                                selected={currentPickValue === opt.value}
                                disabled={isSaving}
                                onClick={() => savePrediction(fixture, opt.value)}
                              />
                            ))}
                          </div>
                        ) : isRace ? (
                          <div className="flex gap-2">
                            <ComboboxInput
                              options={getRaceEntrants(fixture.sport)}
                              value={raceInputs[fixture.external_event_id] ?? currentPickValue ?? ""}
                              onChange={(val) =>
                                setRaceInputs((r) => ({
                                  ...r,
                                  [fixture.external_event_id]: val,
                                }))
                              }
                              placeholder="Predicted winner\u2026"
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                savePrediction(
                                  fixture,
                                  raceInputs[fixture.external_event_id] ?? ""
                                )
                              }
                              disabled={
                                isSaving ||
                                !(raceInputs[fixture.external_event_id] ?? "").trim()
                              }
                              className="rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-2 text-xs font-extrabold text-[#1a1208] disabled:opacity-40"
                            >
                              Pick
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] font-semibold text-ps-text-ter">
                            Fixture data not available for predictions
                          </p>
                        )}

                        {/* Exact score input — shown for team sports that support it */}
                        {!isLocked && !isRace && hasTeams && supportsExactScore(fixture.sport) && (
                          <PersonalScoreInput
                            fixture={fixture}
                            existingScore={existingScore}
                            currentPick={currentPickValue}
                            isSaving={isSaving}
                            onSaveWithScore={savePredictionWithScore}
                          />
                        )}

                        {/* Show existing score when locked */}
                        {isLocked && existingScore && (
                          <div className="mt-2 rounded-lg bg-ps-amber-soft border border-ps-amber/20 px-3 py-2">
                            <span className="text-[11px] font-medium uppercase text-ps-amber-deep">
                              Exact Score:{" "}
                            </span>
                            <span className="font-mono text-sm font-medium text-ps-text">
                              {formatScoreDisplay(existingScore, fixture.sport)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function TabButton({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 pb-2.5 pr-5 text-sm font-extrabold tracking-tight transition-colors ${
        active
          ? "border-b-2 border-ps-amber text-ps-text"
          : "text-ps-text-ter hover:text-ps-text-sec"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
            active ? "bg-ps-amber text-[#1a1208]" : "bg-ps-chip text-ps-text-ter"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-ps-text-ter"
    >
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
