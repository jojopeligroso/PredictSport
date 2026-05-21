"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PickButton } from "@/components/ui/PickButton";
import { SportPill } from "@/components/ui";
import { ComboboxInput } from "@/components/ui/ComboboxInput";
import { getRaceEntrants } from "@/lib/race-entrants";
import { toSportKey, SPORT_CONFIG, type SportKey } from "@/components/ui/sport-config";
import {
  ExactScoreInput,
  emptyScore,
  isScoreComplete,
  scoreToData,
  dataToScore,
  type ScoreValue,
} from "@/components/ExactScoreInput";
import { supportsExactScore, deriveWinnerFromScore } from "@/lib/score-format";
import { hasTBAParticipant } from "@/lib/sports/tba-detection";
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
      { id: "4387", label: "NBA", sport: "basketball" },
      { id: "4424", label: "MLB", sport: "baseball" },
      { id: "4380", label: "NHL", sport: "ice_hockey" },
      { id: "4391", label: "NFL", sport: "american_football" },
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

function getSportCategoryForLeague(leagueId: string): string | null {
  for (const group of LEAGUE_GROUPS) {
    if (group.leagues.some((l) => l.id === leagueId)) {
      for (const cat of SPORT_CATEGORIES) {
        if (cat.groupLabels.includes(group.label)) return cat.label;
      }
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

const MAX_OUTRIGHT_CHANGES = 2; // Must match API route constant

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
  tournament_started: boolean;
  picked_pre_start: boolean;
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

interface OutrightSuggestion {
  provider_league: string;
  league_name: string;
  pick_count: number;
  sport: string;
}

function OutrightsTab({ onNavigateToLeague }: { onNavigateToLeague?: (sportCategory: string, leagueId: string) => void }) {
  const [outrights, setOutrights] = useState<OutrightEntry[]>([]);
  const [suggestions, setSuggestions] = useState<OutrightSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [outrightsRes, suggestionsRes] = await Promise.all([
          fetch("/api/personal-predictions/outrights"),
          fetch("/api/personal-predictions/outright-suggestions"),
        ]);
        if (!outrightsRes.ok) throw new Error(`Failed to load outrights (${outrightsRes.status})`);
        const outrightsData = await outrightsRes.json();
        if (!cancelled) setOutrights(outrightsData.outrights ?? []);

        if (suggestionsRes.ok) {
          const suggestionsData = await suggestionsRes.json();
          if (!cancelled) setSuggestions(suggestionsData.suggestions ?? []);
        }
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

  async function dismissSuggestion(providerLeague: string) {
    setDismissing((prev) => ({ ...prev, [providerLeague]: true }));
    try {
      const res = await fetch("/api/personal-predictions/outright-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_league: providerLeague, action: "dismiss" }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.provider_league !== providerLeague));
      }
    } finally {
      setDismissing((prev) => ({ ...prev, [providerLeague]: false }));
    }
  }

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

  // Group outrights by status
  const grouped = new Map<OutrightStatus, OutrightEntry[]>();
  for (const o of outrights) {
    const s = classifyOutright(o);
    if (!grouped.has(s)) grouped.set(s, []);
    grouped.get(s)!.push(o);
  }

  const ORDER: OutrightStatus[] = ["open", "pending", "resolved"];
  const hasOutrights = outrights.length > 0;

  // Filter suggestions to known leagues only
  const validSuggestions = suggestions.filter((s) => getLeagueLabel(s.provider_league));

  return (
    <div className="flex flex-col gap-5">
      {/* Suggestions */}
      {validSuggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Suggested outrights
          </p>
          <div className="flex flex-col gap-2">
            {validSuggestions.map((s) => {
              const leagueLabel = getLeagueLabel(s.provider_league) ?? s.league_name;
              const sportCategory = getSportCategoryForLeague(s.provider_league);
              return (
                <div
                  key={s.provider_league}
                  className="group relative flex items-center gap-3 rounded-xl border border-dashed border-ps-amber/40 bg-ps-amber-soft/30 px-4 py-3 transition-colors hover:border-ps-amber/60 hover:bg-ps-amber-soft/50"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      if (onNavigateToLeague && sportCategory) {
                        onNavigateToLeague(sportCategory, s.provider_league);
                      }
                    }}
                    disabled={!onNavigateToLeague || !sportCategory}
                  >
                    <p className="text-sm font-bold text-ps-text">
                      Who wins {leagueLabel}?
                    </p>
                    <p className="mt-0.5 text-xs text-ps-text-ter">
                      You&apos;ve picked {s.pick_count} {leagueLabel} fixtures
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissSuggestion(s.provider_league);
                    }}
                    disabled={dismissing[s.provider_league]}
                    className="shrink-0 rounded-full p-1.5 text-ps-text-ter transition-colors hover:bg-ps-chip hover:text-ps-text"
                    aria-label={`Dismiss ${leagueLabel} suggestion`}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing outrights grouped by status */}
      {hasOutrights ? (
        ORDER.filter((s) => grouped.has(s)).map((status) => (
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
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-14 text-center">
          <p className="text-sm font-bold text-ps-text-sec">No outrights yet</p>
          <p className="mt-1 text-xs text-ps-text-ter">
            Browse fixtures and pick who wins a league or tournament.
          </p>
        </div>
      )}
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
  const [showHistory, setShowHistory] = useState(false);

  const borderClass =
    status === "resolved"
      ? outright.is_correct
        ? "border-ps-green/40"
        : "border-ps-border"
      : status === "pending"
        ? "border-ps-amber/40"
        : "border-ps-border";

  const changesUsed = Math.max(0, outright.change_history.length - 1);
  const changesRemaining = Math.max(0, MAX_OUTRIGHT_CHANGES - changesUsed);
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
            {status === "open" && changesUsed > 0 && (
              <span className={`font-mono text-[10px] font-semibold ${
                changesRemaining === 0
                  ? "text-ps-red"
                  : changesRemaining === 1
                    ? "text-ps-amber-deep"
                    : "text-ps-text-ter"
              }`}>
                {changesRemaining === 0
                  ? "No changes left"
                  : `${changesRemaining}/${MAX_OUTRIGHT_CHANGES} left`}
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
          {/* Contextual subtitle: date, "Change your mind?", or nothing */}
          {!resultWinner && status === "open" && (
            outright.tournament_started
              ? (!outright.picked_pre_start || outright.change_history.length > 1) && outright.change_history.length > 0 && (
                <p className="mt-0.5 font-mono text-[10px] text-ps-text-ter">
                  {formatChangeDate(outright.change_history[outright.change_history.length - 1].changed_at)}
                </p>
              )
              : (
                <p className="mt-0.5 text-[10px] font-semibold italic text-ps-amber-deep">
                  Change your mind?
                </p>
              )
          )}
        </div>
      </div>

      {/* Expandable change history */}
      {outright.change_history.length > 1 && (
        <div className="mt-2 border-t border-ps-border/50 pt-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold text-ps-text-ter hover:text-ps-text-sec"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              className={`transition-transform ${showHistory ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {changesUsed} change{changesUsed !== 1 ? "s" : ""} made
          </button>
          {showHistory && (
            <div className="mt-1.5 flex flex-col gap-1">
              {outright.change_history.map((h, i) => (
                <div key={h.changed_at} className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono text-ps-text-ter">{formatChangeDate(h.changed_at)}</span>
                  <span className={`font-semibold ${i === outright.change_history.length - 1 ? "text-ps-text" : "text-ps-text-ter line-through"}`}>
                    {h.pick}
                  </span>
                  {i === 0 && <span className="text-ps-text-ter">(initial)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

function formatChangeDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleString("en-IE", { month: "short" });
  const hr = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${mon}, ${hr}:${min}`;
}

function ContextualOutrightCard({
  leagueId,
  leagueName,
  sport,
  existingOutright,
  tournamentStarted,
  onSave,
  teamOptions,
}: {
  leagueId: string;
  leagueName: string;
  sport: string;
  existingOutright: OutrightPick | undefined;
  tournamentStarted: boolean;
  onSave: (leagueId: string, leagueName: string, sport: string, pick: string, tournamentStarted: boolean) => Promise<unknown>;
  teamOptions: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickInput, setPickInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const history = existingOutright?.change_history ?? [];
  const changesUsed = Math.max(0, history.length - 1);
  const changesRemaining = tournamentStarted
    ? Math.max(0, MAX_OUTRIGHT_CHANGES - changesUsed)
    : MAX_OUTRIGHT_CHANGES;
  const budgetExhausted = tournamentStarted && changesRemaining <= 0;

  // Reset expansion when league changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on prop change
    setIsExpanded(false);
    setPickInput("");
    setIsEditing(false);
    setShowHistory(false);
    setShowConfirm(false);
  }, [leagueId]);

  const doSubmit = async () => {
    if (!pickInput.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(leagueId, leagueName, sport, pickInput.trim(), tournamentStarted);
      setIsExpanded(false);
      setIsEditing(false);
      setShowConfirm(false);
      setPickInput("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => {
    // If tournament started and changing an existing pick, show confirm dialog
    if (tournamentStarted && existingOutright?.pick && pickInput.trim() !== existingOutright.pick) {
      setShowConfirm(true);
      return;
    }
    doSubmit();
  };

  const handleChangeClick = () => {
    if (budgetExhausted) return;
    setIsEditing(true);
    setPickInput(existingOutright?.pick ?? "");
  };

  // Confirm dialog overlay
  if (showConfirm) {
    return (
      <div className="mb-4 rounded-2xl border border-ps-amber/30 bg-ps-amber-soft p-4">
        <p className="text-sm font-extrabold text-ps-text">
          Change your pick?
        </p>
        <p className="mt-1.5 text-xs text-ps-text-sec leading-relaxed">
          You&apos;re switching from <span className="font-bold text-ps-text">{existingOutright?.pick}</span> to{" "}
          <span className="font-bold text-ps-text">{pickInput.trim()}</span>.
          {changesRemaining <= 1 && (
            <span className="font-bold text-ps-red"> This is your last change.</span>
          )}
          {changesRemaining > 1 && (
            <span> You&apos;ll have {changesRemaining - 1} change{changesRemaining - 1 !== 1 ? "s" : ""} left.</span>
          )}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
            }}
            className="flex-1 rounded-lg border border-ps-border px-3 py-2 text-xs font-semibold text-ps-text-sec"
          >
            Keep {existingOutright?.pick}
          </button>
          <button
            type="button"
            onClick={doSubmit}
            disabled={isSaving}
            className="flex-1 rounded-lg bg-ps-amber px-3 py-2 text-xs font-extrabold text-[#1a1208] disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Confirm change"}
          </button>
        </div>
      </div>
    );
  }

  // Already has an outright pick
  if (existingOutright?.pick && !isEditing) {
    return (
      <div className="mb-4 rounded-2xl border border-ps-amber/30 bg-ps-amber-soft p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-amber-deep">
              Outright Winner
            </p>
            <p className="mt-1 text-sm font-extrabold text-ps-text">
              {existingOutright.pick}
            </p>
            {tournamentStarted ? (
              history.length > 1 ? (
                <p className="mt-0.5 font-mono text-[10px] text-ps-text-ter">
                  Picked {formatChangeDate(history[history.length - 1].changed_at)}
                </p>
              ) : null
            ) : (
              <p className="mt-0.5 text-[11px] font-semibold italic text-ps-amber-deep">
                Change your mind?
              </p>
            )}
            {/* Change budget badge */}
            {tournamentStarted && (
              <p className={`mt-1.5 font-mono text-[10px] font-semibold ${
                changesRemaining === 0
                  ? "text-ps-red"
                  : changesRemaining === 1
                    ? "text-ps-amber-deep"
                    : "text-ps-text-ter"
              }`}>
                {changesRemaining === 0
                  ? "No changes remaining"
                  : `${changesRemaining} change${changesRemaining !== 1 ? "s" : ""} remaining`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleChangeClick}
            disabled={budgetExhausted}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              budgetExhausted
                ? "border-ps-border/50 text-ps-text-ter/50 cursor-not-allowed"
                : "border-ps-border text-ps-text-sec hover:border-ps-amber hover:text-ps-text"
            }`}
          >
            Change
          </button>
        </div>
        {/* Timestamped change history */}
        {history.length > 1 && (
          <div className="mt-2 border-t border-ps-amber/20 pt-2">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-ps-text-ter hover:text-ps-text-sec"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-transform ${showHistory ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {history.length - 1} change{history.length - 1 !== 1 ? "s" : ""} made
            </button>
            {showHistory && (
              <div className="mt-1.5 flex flex-col gap-1">
                {history.map((h, i) => (
                  <div key={h.changed_at} className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono text-ps-text-ter">{formatChangeDate(h.changed_at)}</span>
                    <span className={`font-semibold ${i === history.length - 1 ? "text-ps-text" : "text-ps-text-ter line-through"}`}>
                      {h.pick}
                    </span>
                    {i === 0 && <span className="text-ps-text-ter">(initial)</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
          {isEditing && tournamentStarted
            ? `Change your outright prediction (${changesRemaining} change${changesRemaining !== 1 ? "s" : ""} remaining)`
            : "Make your outright prediction for the season"}
        </p>
        <div className="mt-3 flex gap-2">
          {teamOptions.length > 0 ? (
            <ComboboxInput
              options={teamOptions}
              value={pickInput}
              onChange={setPickInput}
              disabled={isSaving}
              placeholder="Select team or player..."
              className="flex-1"
            />
          ) : (
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
          )}
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

  const [activeTab, setActiveTab] = useState<"fixtures" | "my-picks" | "outrights" | "results" | "dashboard">("fixtures");
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

  const navigateToLeague = useCallback((sportCategory: string, leagueId: string) => {
    setSelectedSport(sportCategory);
    setSelectedLeagueId(leagueId);
    setShowAllLeagues(false);
    setActiveTab("fixtures");
    sessionStorage.setItem("ps-selected-sport", sportCategory);
    sessionStorage.setItem("ps-selected-league", leagueId);
    router.replace(
      `${pathname}?sport=${encodeURIComponent(sportCategory)}&league=${encodeURIComponent(leagueId)}`,
      { scroll: false },
    );
  }, [pathname, router]);

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

  // Compute whether the selected league's tournament has started.
  // We check if any loaded fixture has a start_time in the past.
  // Using a state + effect avoids the impure-render lint rule (Date.now in useMemo).
  const [tournamentStarted, setTournamentStarted] = useState(false);
  useEffect(() => {
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from fixtures + wall clock
    setTournamentStarted(fixtures.some((f) => new Date(f.start_time).getTime() < now));
  }, [fixtures]);

  // Derive unique team/participant names for outright autocomplete.
  // Fixtures are already filtered to the selected league by the fetch call.
  const outrightTeamOptions = useMemo(() => {
    const teams = new Set<string>();
    for (const f of fixtures) {
      for (const p of f.participants) {
        if (p && p !== "Draw") teams.add(p);
      }
    }
    return [...teams].sort((a, b) => a.localeCompare(b));
  }, [fixtures]);

  // Save outright prediction
  const saveOutright = useCallback(async (
    leagueId: string,
    leagueName: string,
    sport: string,
    pick: string,
    tournamentHasStarted: boolean,
  ) => {
    const res = await fetch("/api/personal-predictions/outrights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        league_id: leagueId,
        league_name: leagueName,
        sport,
        pick,
        tournament_started: tournamentHasStarted,
      }),
    });

    const resData = (await res.json()) as { error?: string; changes_remaining?: number };
    if (!res.ok) {
      throw new Error(resData.error ?? "Failed to save outright");
    }
    setOutrights((prev) => {
      const next = new Map(prev);
      const existing = next.get(leagueId);
      const newHistory = tournamentHasStarted
        ? [...(existing?.change_history ?? []), { pick, changed_at: new Date().toISOString() }]
        : [{ pick, changed_at: new Date().toISOString() }]; // Pre-start: replace
      next.set(leagueId, {
        league_id: leagueId,
        league_name: leagueName,
        sport,
        pick,
        change_history: newHistory,
      });
      return next;
    });
    return resData;
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

  // Filter out TBA fixtures and group by date
  const { grouped, tbaCount } = useMemo(() => {
    const eligible: NormalizedFixture[] = [];
    let hidden = 0;
    for (const f of fixtures) {
      if (hasTBAParticipant(f.participants)) {
        hidden++;
      } else {
        eligible.push(f);
      }
    }
    const map = new Map<string, NormalizedFixture[]>();
    for (const f of eligible) {
      const key = dateKey(f.start_time);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return {
      grouped: Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)),
      tbaCount: hidden,
    };
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
        <TabButton
          label="Dashboard"
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
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
      {activeTab === "outrights" && <OutrightsTab onNavigateToLeague={navigateToLeague} />}

      {/* Results tab */}
      {activeTab === "results" && <ResultsTab picks={picks} />}

      {/* Dashboard tab */}
      {activeTab === "dashboard" && <DashboardTab />}

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
              tournamentStarted={tournamentStarted}
              onSave={saveOutright}
              teamOptions={outrightTeamOptions}
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

          {/* TBA fixtures hidden notice */}
          {!loading && tbaCount > 0 && (
            <p className="text-xs font-semibold text-ps-text-ter">
              {tbaCount} {tbaCount === 1 ? "fixture" : "fixtures"} hidden — teams not yet confirmed
            </p>
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

// ── Dashboard tab content ─────────────────────────────────────────────────────

interface DashboardStats {
  summary: {
    total_picks: number;
    resolved: number;
    correct: number;
    hit_rate: number | null;
    current_streak: number;
    current_streak_type: "W" | "L" | null;
    best_streak: number;
  };
  by_sport: Record<string, { total: number; correct: number; wrong: number; pending: number; hit_rate: number | null }>;
  by_league: Record<string, { sport: string; total: number; correct: number; wrong: number; pending: number; hit_rate: number | null }>;
  by_year: Record<string, { total: number; correct: number; wrong: number; pending: number; hit_rate: number | null }>;
  recent_picks: Array<{
    prediction_id: string;
    event_name: string;
    sport: string;
    league: string | null;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    result_data: Record<string, unknown> | null;
    start_time: string;
  }>;
  favourite_team: { sport: string; team_name: string; provider_id: string | null } | null;
  favourite_team_picks: Array<{
    prediction_id: string;
    event_name: string;
    sport: string;
    league: string | null;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    result_data: Record<string, unknown> | null;
    start_time: string;
  }>;
}

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillSport, setDrillSport] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const leagueSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/personal-predictions/stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
          if (!data.favourite_team && !localStorage.getItem("ps_onboarding_fav_team")) {
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ps-amber border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-red/30 bg-ps-red/10 py-14 text-center">
        <p className="text-sm font-bold text-ps-text-sec">{error ?? "Could not load stats"}</p>
      </div>
    );
  }

  const { summary, recent_picks, by_year, by_sport, by_league, favourite_team, favourite_team_picks } = stats;

  // Empty state
  if (summary.total_picks === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-amber/30 bg-ps-amber-soft/50 py-14 text-center">
        <p className="text-sm font-bold text-ps-text-sec">No predictions yet</p>
        <p className="mt-1 text-xs text-ps-text-ter">
          Make some picks in the Fixtures tab to see your stats here.
        </p>
      </div>
    );
  }

  // Sort years descending
  const yearEntries = Object.entries(by_year)
    .sort(([a], [b]) => Number(b) - Number(a));

  // Sort sports by total picks descending
  const sportEntries = Object.entries(by_sport)
    .sort(([, a], [, b]) => b.total - a.total);

  // Sort leagues by total picks descending, filter by drilled sport if set
  const leagueEntries = Object.entries(by_league)
    .filter(([, data]) => drillSport === null || data.sport === drillSport)
    .sort(([, a], [, b]) => b.total - a.total);

  function handleSportDrill(sport: string) {
    setDrillSport(prev => prev === sport ? null : sport);
    setTimeout(() => leagueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  const [showCustomiseToast, setShowCustomiseToast] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {showOnboarding && (
        <FavouriteTeamOnboarding
          onDismiss={() => setShowOnboarding(false)}
          onSaved={() => {
            setShowOnboarding(false);
            // Re-fetch stats to pick up the new favourite_team
            fetch("/api/personal-predictions/stats")
              .then((r) => r.json())
              .then((data) => setStats(data))
              .catch(() => {});
          }}
        />
      )}

      {/* Header with Customise button */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setShowCustomiseToast(true);
            setTimeout(() => setShowCustomiseToast(false), 2500);
          }}
          className="rounded-full bg-ps-ink/5 px-3 py-1 text-[10px] font-bold text-ps-text-sec transition-colors hover:bg-ps-ink/10"
        >
          Customise
        </button>
      </div>
      {showCustomiseToast && (
        <div className="animate-in fade-in rounded-lg bg-ps-ink px-3 py-2 text-center text-xs font-semibold text-ps-cream">
          Widget reordering coming soon.
        </div>
      )}

      {/* Recent Picks */}
      <RecentPicksWidget picks={recent_picks} />

      {/* Summary Strip */}
      <DashboardSection title="Lifetime">
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatCell label="Picks" value={String(summary.total_picks)} />
          <StatCell
            label="Hit Rate"
            value={summary.hit_rate !== null ? `${Math.round(summary.hit_rate * 100)}%` : "—"}
          />
          <StatCell
            label="Streak"
            value={summary.current_streak > 0 ? `${summary.current_streak}${summary.current_streak_type}` : "—"}
          />
          <StatCell
            label="Best"
            value={summary.best_streak > 0 ? `${summary.best_streak}W` : "—"}
          />
        </div>
      </DashboardSection>

      {/* By Year */}
      {yearEntries.length > 0 && (
        <ByYearWidget yearEntries={yearEntries} />
      )}

      {/* By Sport */}
      {sportEntries.length > 0 && (
        <DashboardSection title="By Sport">
          <div className="flex flex-col gap-1.5">
            {sportEntries.map(([sport, data]) => {
              const cfg = SPORT_CONFIG[toSportKey(sport as Sport)];
              const active = drillSport === sport;
              return (
                <BreakdownRow
                  key={sport}
                  label={`${cfg?.emoji ?? ""} ${cfg?.name ?? sport}`}
                  total={data.total}
                  correct={data.correct}
                  hitRate={data.hit_rate}
                  active={active}
                  onClick={() => handleSportDrill(sport)}
                />
              );
            })}
          </div>
        </DashboardSection>
      )}

      {/* By League */}
      {leagueEntries.length > 0 && (
        <div ref={leagueSectionRef}>
          <DashboardSection
            title={drillSport ? `By League — ${SPORT_CONFIG[toSportKey(drillSport as Sport)]?.name ?? drillSport}` : "By League"}
          >
            <div className="flex flex-col gap-1.5">
              {leagueEntries.map(([league, data]) => (
                <BreakdownRow
                  key={league}
                  label={league}
                  total={data.total}
                  correct={data.correct}
                  hitRate={data.hit_rate}
                />
              ))}
            </div>
          </DashboardSection>
        </div>
      )}

      {/* Favourite Team */}
      <FavouriteTeamWidget team={favourite_team} picks={favourite_team_picks} />
    </div>
  );
}

const RECENT_PICKS_PREVIEW = 5;

function RecentPicksWidget({ picks }: { picks: DashboardStats["recent_picks"] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? picks : picks.slice(0, RECENT_PICKS_PREVIEW);
  const hasMore = picks.length > RECENT_PICKS_PREVIEW;

  return (
    <DashboardSection title="Recent Picks">
      <div className="flex flex-col gap-1">
        {visible.map((pick) => {
          const sportKey = toSportKey(pick.sport as Sport);
          const cfg = SPORT_CONFIG[sportKey];
          return (
            <div
              key={pick.prediction_id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
            >
              {/* Result indicator */}
              <div
                className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                  pick.is_correct === null
                    ? "bg-ps-chip text-ps-text-ter"
                    : pick.is_correct
                      ? "bg-ps-green-soft text-ps-green"
                      : "bg-ps-red/10 text-ps-red"
                }`}
              >
                {pick.is_correct === null ? "?" : pick.is_correct ? "W" : "L"}
              </div>

              {/* Pick value + event name */}
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-ps-text">
                {(pick.prediction_data?.value as string) ?? "—"}
                <span className="ml-1.5 font-medium text-ps-text-ter">
                  {pick.event_name}
                </span>
              </span>

              {/* Sport tag */}
              <span className="shrink-0 rounded-full bg-ps-chip px-1.5 py-0.5 text-[9px] font-bold text-ps-text-ter">
                {cfg?.emoji} {cfg?.name ?? pick.sport}
              </span>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-[11px] font-bold text-ps-amber hover:text-ps-amber/80 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${picks.length} picks`}
        </button>
      )}
    </DashboardSection>
  );
}

function FavouriteTeamOnboarding({ onDismiss, onSaved }: { onDismiss: () => void; onSaved: () => void }) {
  const sportKeys = Object.keys(SPORT_CONFIG) as SportKey[];
  const [selectedSport, setSelectedSport] = useState<string>(sportKeys[0]);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const name = teamName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favourite_team: { sport: selectedSport, team_name: name, provider_id: null },
        }),
      });
      if (res.ok) {
        localStorage.setItem("ps_onboarding_fav_team", "done");
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    localStorage.setItem("ps_onboarding_fav_team", "done");
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ps-border bg-ps-bg p-6 shadow-xl">
        <p className="text-center font-display text-lg font-extrabold text-ps-text">
          Got a favourite team?
        </p>
        <p className="mt-1.5 text-center text-xs text-ps-text-sec">
          We&apos;ll track your picks for them.
        </p>

        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            Sport
          </label>
          <div className="flex flex-wrap gap-1.5">
            {sportKeys.map((key) => {
              const cfg = SPORT_CONFIG[key];
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSport(key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    key === selectedSport
                      ? "bg-ps-amber text-ps-ink"
                      : "bg-ps-ink/5 text-ps-text-sec hover:bg-ps-ink/10"
                  }`}
                >
                  {cfg.emoji} {cfg.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            Team name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamName(e.target.value)}
            placeholder="e.g. Liverpool, Wexford, Red Bull"
            className="w-full rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 rounded-xl bg-ps-ink/5 py-2.5 text-xs font-bold text-ps-text-sec transition-colors hover:bg-ps-ink/10"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={!teamName.trim() || saving}
            className="flex-1 rounded-xl bg-ps-amber py-2.5 text-xs font-bold text-ps-ink transition-colors hover:bg-ps-amber/90 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FavouriteTeamWidget({
  team,
  picks,
}: {
  team: DashboardStats["favourite_team"];
  picks: DashboardStats["favourite_team_picks"];
}) {
  if (!team) {
    return (
      <DashboardSection title="Favourite Team">
        <div className="py-2 text-center">
          <p className="text-xs font-semibold text-ps-text-sec">No favourite team set</p>
          <a
            href="/profile"
            className="mt-1.5 inline-block rounded-full bg-ps-amber/15 px-3 py-1 text-[10px] font-bold text-ps-amber transition-colors hover:bg-ps-amber/25"
          >
            Set a favourite team
          </a>
        </div>
      </DashboardSection>
    );
  }

  const resolved = picks.filter((p) => p.is_correct !== null);
  const correct = resolved.filter((p) => p.is_correct === true).length;
  const hitRate = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null;
  const sportKey = toSportKey(team.sport as Sport);
  const cfg = SPORT_CONFIG[sportKey];

  return (
    <DashboardSection title={`${cfg?.emoji ?? ""} ${team.team_name}`}>
      {picks.length === 0 ? (
        <p className="py-2 text-center text-xs text-ps-text-ter">
          No picks involving {team.team_name} yet.
        </p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <StatCell label="Picks" value={String(picks.length)} />
            <StatCell label="Correct" value={String(correct)} />
            <StatCell label="Hit Rate" value={hitRate !== null ? `${hitRate}%` : "—"} />
          </div>
          <div className="flex flex-col gap-1">
            {picks.slice(0, 5).map((pick) => (
              <div
                key={pick.prediction_id}
                className="flex items-center gap-2 rounded-lg px-2 py-1"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  pick.is_correct === true
                    ? "bg-ps-green"
                    : pick.is_correct === false
                      ? "bg-ps-red"
                      : "bg-ps-text-ter/30"
                }`} />
                <span className="min-w-0 flex-1 truncate text-xs text-ps-text">
                  {pick.event_name}
                </span>
                <span className="font-mono text-[10px] text-ps-text-ter">
                  {pick.is_correct === true ? "W" : pick.is_correct === false ? "L" : "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardSection>
  );
}

function ByYearWidget({ yearEntries }: { yearEntries: [string, { total: number; correct: number; wrong: number; pending: number; hit_rate: number | null }][] }) {
  const currentYear = String(new Date().getFullYear());
  const defaultYear = yearEntries.find(([y]) => y === currentYear)?.[0] ?? yearEntries[0]?.[0];
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const selected = yearEntries.find(([y]) => y === selectedYear);

  if (!selected) return null;
  const [, data] = selected;
  const pct = data.hit_rate !== null ? Math.round(data.hit_rate * 100) : null;

  return (
    <DashboardSection title="By Year">
      <div className="mb-3 flex gap-1.5">
        {yearEntries.map(([year]) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              year === selectedYear
                ? "bg-ps-amber text-ps-ink"
                : "bg-ps-ink/5 text-ps-text-sec hover:bg-ps-ink/10"
            }`}
          >
            {year}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell label="Picks" value={String(data.total)} />
        <StatCell label="Correct" value={String(data.correct)} />
        <StatCell label="Hit Rate" value={pct !== null ? `${pct}%` : "—"} />
      </div>
    </DashboardSection>
  );
}

function DashboardSection({ title, children }: { title: string; children: import("react").ReactNode }) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-3">
      <p className="mb-2.5 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
        {title}
      </p>
      {children}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-base font-extrabold text-ps-text">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-ps-text-ter">{label}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  total,
  correct,
  hitRate,
  onClick,
  active,
}: {
  label: string;
  total: number;
  correct: number;
  hitRate: number | null;
  onClick?: () => void;
  active?: boolean;
}) {
  const pct = hitRate !== null ? Math.round(hitRate * 100) : null;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-1 py-0.5 transition-colors ${onClick ? "cursor-pointer" : ""} ${active ? "bg-ps-amber/10" : onClick ? "hover:bg-ps-chip/50" : ""}`}
    >
      <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${active ? "text-ps-amber" : "text-ps-text"}`}>
        {label}
      </span>
      <span className="font-mono text-[10px] text-ps-text-ter">
        {correct}/{total}
      </span>
      <span className={`w-10 text-right font-mono text-xs font-extrabold ${active ? "text-ps-amber" : "text-ps-text"}`}>
        {pct !== null ? `${pct}%` : "—"}
      </span>
      {onClick && (
        <svg
          className={`h-3 w-3 flex-shrink-0 transition-transform ${active ? "rotate-90 text-ps-amber" : "text-ps-text-ter"}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 2.5l4 3.5-4 3.5" />
        </svg>
      )}
    </Tag>
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
