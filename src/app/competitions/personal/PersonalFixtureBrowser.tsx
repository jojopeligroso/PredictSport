"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PickButton } from "@/components/ui/PickButton";
import { SportPill } from "@/components/ui";
import { toSportKey } from "@/components/ui/sport-config";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface PredictionOption {
  value: string;
  label: string;
  sub?: string;
}

interface PersonalPredictionRow {
  id: string;
  external_event_id: string;
  prediction_value: string;
  event_name: string;
  sport: string;
  competition_name: string | null;
  participants: string[];
  start_time: string;
  result_value: string | null;
  is_correct: boolean | null;
  provider_league: string | null;
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
      { value: "home", label: home, sub: "Home" },
      { value: "draw", label: "Draw" },
      { value: "away", label: away, sub: "Away" },
    ];
  }

  return [
    { value: "home", label: home },
    { value: "away", label: away },
  ];
}

function resolvePickLabel(value: string, participants: string[]): string {
  if (value === "home") return participants[0] ?? value;
  if (value === "away") return participants[1] ?? value;
  if (value === "draw") return "Draw";
  return value;
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
}: {
  pick: PersonalPredictionRow;
  showResultHints: boolean;
}) {
  const participants = Array.isArray(pick.participants) ? pick.participants : [];
  const [home, away] = participants;
  const hasTeams = Boolean(home && away);
  const pickLabel = resolvePickLabel(pick.prediction_value, participants);
  const isPast = new Date(pick.start_time) <= new Date();
  const hasResult = pick.result_value !== null && pick.is_correct !== null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-ps-surface transition-colors ${
        isPast && showResultHints && hasResult
          ? pick.is_correct
            ? "border-ps-green/40"
            : "border-ps-border"
          : isPast
            ? "border-ps-border"
            : "border-ps-amber/35"
      }`}
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
          {pick.competition_name && (
            <span className="max-w-[100px] truncate rounded-full bg-ps-chip px-1.5 py-px text-[10px] font-semibold text-ps-text-ter">
              {pick.competition_name}
            </span>
          )}
        </div>
      </div>

      {/* Right: pick + result */}
      <div className="shrink-0 text-right">
        <p className="text-xs font-extrabold text-ps-text">{pickLabel}</p>
        {isPast && showResultHints && hasResult ? (
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
              pick.is_correct
                ? "bg-ps-green-soft text-ps-green"
                : "bg-ps-red/10 text-ps-red"
            }`}
          >
            {pick.is_correct ? "Correct" : "Wrong"}
          </span>
        ) : isPast && pick.result_value !== null ? (
          <p className="mt-0.5 text-[10px] font-semibold text-ps-text-ter">
            Result: {pick.result_value}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── My Picks tab content ──────────────────────────────────────────────────────

function MyPicksTab({
  allPredictions,
  showResultHints,
}: {
  allPredictions: PersonalPredictionRow[];
  showResultHints: boolean;
}) {
  const now = new Date();

  const upcomingPicks = useMemo(
    () =>
      allPredictions
        .filter((p) => new Date(p.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPredictions]
  );

  const pastPicks = useMemo(
    () =>
      allPredictions
        .filter((p) => new Date(p.start_time) <= now)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPredictions]
  );

  if (allPredictions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-border py-14 text-center">
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
              <PickRow key={pick.external_event_id} pick={pick} showResultHints={showResultHints} />
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
              <PickRow key={pick.external_event_id} pick={pick} showResultHints={showResultHints} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Results tab content ───────────────────────────────────────────────────────

function ResultsTab({ allPredictions }: { allPredictions: PersonalPredictionRow[] }) {
  const settled = useMemo(
    () =>
      allPredictions
        .filter((p) => p.result_value !== null && p.is_correct !== null)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    [allPredictions]
  );

  const correct = settled.filter((p) => p.is_correct).length;

  if (settled.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ps-border py-14 text-center">
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
      <div className="flex items-center gap-3 rounded-xl border border-ps-border bg-ps-surface px-4 py-3">
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

      {/* Results list */}
      <div className="flex flex-col gap-2">
        {settled.map((pick) => {
          const participants = Array.isArray(pick.participants) ? pick.participants : [];
          const [home, away] = participants;
          const hasTeams = Boolean(home && away);
          const pickLabel = resolvePickLabel(pick.prediction_value, participants);
          const resultLabel = resolvePickLabel(pick.result_value!, participants);

          return (
            <div
              key={pick.external_event_id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-ps-surface ${
                pick.is_correct ? "border-ps-green/40" : "border-ps-border"
              }`}
            >
              {/* Outcome indicator */}
              <div
                className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  pick.is_correct
                    ? "bg-ps-green-soft text-ps-green"
                    : "bg-ps-red/10 text-ps-red"
                }`}
              >
                {pick.is_correct ? "W" : "L"}
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

// ── Main component ────────────────────────────────────────────────────────────

export function PersonalFixtureBrowser({
  showResultHints = true,
  defaultSport = "Soccer",
}: {
  showResultHints?: boolean;
  defaultSport?: string;
}) {
  const initialLeague = leaguesForCategory(defaultSport)[0] ?? leaguesForCategory("Soccer")[0];
  const [activeTab, setActiveTab] = useState<"fixtures" | "my-picks" | "results">("fixtures");
  const [selectedSport, setSelectedSport] = useState(defaultSport);
  const [selectedLeagueId, setSelectedLeagueId] = useState(initialLeague.id);
  const [fixtures, setFixtures] = useState<NormalizedFixture[]>([]);
  const [allPredictions, setAllPredictions] = useState<PersonalPredictionRow[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [getError, setGetError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [raceInputs, setRaceInputs] = useState<Record<string, string>>({});

  const currentLeagues = useMemo(() => leaguesForCategory(selectedSport), [selectedSport]);

  const predictionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of allPredictions) {
      map[p.external_event_id] = p.prediction_value;
    }
    return map;
  }, [allPredictions]);

  function selectSport(label: string) {
    setSelectedSport(label);
    const first = leaguesForCategory(label)[0];
    if (first) setSelectedLeagueId(first.id);
  }

  // Load all personal predictions from DB on mount
  useEffect(() => {
    fetch("/api/personal-predictions")
      .then(async (r) => {
        const d = await r.json() as { predictions?: PersonalPredictionRow[]; error?: string };
        if (!r.ok || d.error) {
          setGetError(d.error ?? "Failed to load your predictions");
          return;
        }
        setAllPredictions(d.predictions ?? []);
      })
      .catch(() => setGetError("Failed to load your predictions — check your connection"));
  }, []);

  // Load upcoming fixtures when league changes
  useEffect(() => {
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

    const prevRows = allPredictions;
    setAllPredictions((prev) => {
      const without = prev.filter((p) => p.external_event_id !== fixture.external_event_id);
      return [
        ...without,
        {
          id: "",
          external_event_id: fixture.external_event_id,
          prediction_value: value,
          event_name: fixture.event_name,
          sport: fixture.sport,
          competition_name: fixture.competition_name ?? null,
          participants: fixture.participants,
          start_time: fixture.start_time,
          result_value: null,
          is_correct: null,
          provider_league: fixture.provider_league,
        },
      ];
    });

    try {
      const res = await fetch("/api/personal-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_event_id: fixture.external_event_id,
          event_name: fixture.event_name,
          sport: fixture.sport,
          competition_name: fixture.competition_name,
          participants: fixture.participants,
          start_time: fixture.start_time,
          prediction_value: value,
          provider_league: fixture.provider_league,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setSaveError(err.error ?? "Failed to save");
        setAllPredictions(prevRows);
      } else {
        const saved = (await res.json()) as { prediction?: PersonalPredictionRow };
        if (saved.prediction) {
          setAllPredictions((prev) => {
            const without = prev.filter((p) => p.external_event_id !== fixture.external_event_id);
            return [...without, saved.prediction!];
          });
        }
      }
    } catch {
      setSaveError("Failed to save prediction");
      setAllPredictions(prevRows);
    } finally {
      setSaving((s) => ({ ...s, [fixture.external_event_id]: false }));
    }
  }, [allPredictions]);

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
          count={allPredictions.length}
          onClick={() => setActiveTab("my-picks")}
        />
        <TabButton
          label="Results"
          active={activeTab === "results"}
          count={allPredictions.filter((p) => p.result_value !== null && p.is_correct !== null).length}
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
        <MyPicksTab allPredictions={allPredictions} showResultHints={showResultHints} />
      )}

      {/* Results tab */}
      {activeTab === "results" && (
        <ResultsTab allPredictions={allPredictions} />
      )}

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
          <div className="mb-5 flex flex-wrap gap-2">
            {currentLeagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => setSelectedLeagueId(league.id)}
                className={
                  selectedLeagueId === league.id
                    ? "rounded-lg border border-ps-amber bg-ps-amber/10 px-3 py-1.5 text-xs font-extrabold text-ps-text"
                    : "rounded-lg border border-ps-border bg-ps-surface px-3 py-1.5 text-xs font-semibold text-ps-text-sec transition-colors hover:border-ps-text-ter hover:text-ps-text"
                }
              >
                {league.label}
              </button>
            ))}
          </div>

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
            <div className="rounded-2xl border border-dashed border-ps-border py-12 text-center">
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
                    const currentPick = predictionMap[fixture.external_event_id];
                    const isSaving = saving[fixture.external_event_id] ?? false;
                    const isRace = RACE_SPORTS.has(fixture.sport);
                    const isLocked = new Date(fixture.start_time) <= now;
                    const [home, away] = fixture.participants;
                    const hasTeams = Boolean(home && away);
                    const pickLabel = resolvePickLabel(currentPick ?? "", fixture.participants);

                    return (
                      <div
                        key={fixture.external_event_id}
                        className={`rounded-2xl border bg-ps-surface p-4 shadow-[0_1px_2px_rgba(40,30,20,0.04)] transition-colors ${
                          currentPick ? "border-ps-amber/40" : "border-ps-border"
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
                              {currentPick && (
                                <span className="rounded-full bg-ps-green-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ps-green">
                                  Picked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prediction area */}
                        {isLocked ? (
                          currentPick ? (
                            <div className="flex items-center gap-1.5">
                              <LockIcon />
                              <span className="text-[11px] font-semibold text-ps-text-sec">
                                Your pick:{" "}
                                <span className="font-extrabold text-ps-text">{pickLabel}</span>
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
                                selected={currentPick === opt.value}
                                disabled={isSaving}
                                onClick={() => savePrediction(fixture, opt.value)}
                              />
                            ))}
                          </div>
                        ) : isRace ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={raceInputs[fixture.external_event_id] ?? currentPick ?? ""}
                              onChange={(e) =>
                                setRaceInputs((r) => ({
                                  ...r,
                                  [fixture.external_event_id]: e.target.value,
                                }))
                              }
                              placeholder="Predicted winner…"
                              className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/40"
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
