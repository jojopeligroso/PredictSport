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
      { id: "4415", label: "Super League", sport: "rugby" },
      { id: "4416", label: "NRL", sport: "rugby" },
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

interface PredictionOption {
  value: string;
  label: string;
  sub?: string;
}

function getPredictionOptions(fixture: NormalizedFixture): PredictionOption[] | null {
  const [home, away] = fixture.participants;

  if (RACE_SPORTS.has(fixture.sport)) {
    // For races: if participants are available, show them; otherwise return null (renders text input)
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

  // No-draw sports (tennis, basketball, etc.)
  return [
    { value: "home", label: home },
    { value: "away", label: away },
  ];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonalPredictionRow {
  id: string;
  external_event_id: string;
  prediction_value: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PersonalFixtureBrowser() {
  const [selectedLeagueId, setSelectedLeagueId] = useState("4328");
  const [fixtures, setFixtures] = useState<NormalizedFixture[]>([]);
  const [predictions, setPredictions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [raceInputs, setRaceInputs] = useState<Record<string, string>>({});

  // Load existing personal predictions once
  useEffect(() => {
    fetch("/api/personal-predictions")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, string> = {};
        for (const p of (d.predictions as PersonalPredictionRow[]) ?? []) {
          map[p.external_event_id] = p.prediction_value;
        }
        setPredictions(map);
      })
      .catch(() => {});
  }, []);

  // Load fixtures on league change
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
    // Optimistic update
    const prev = predictions[fixture.external_event_id];
    setPredictions((p) => ({ ...p, [fixture.external_event_id]: value }));

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
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setSaveError(err.error ?? "Failed to save");
        // Revert
        setPredictions((p) => {
          const copy = { ...p };
          if (prev) copy[fixture.external_event_id] = prev;
          else delete copy[fixture.external_event_id];
          return copy;
        });
      }
    } catch {
      setSaveError("Failed to save prediction");
    } finally {
      setSaving((s) => ({ ...s, [fixture.external_event_id]: false }));
    }
  }, [predictions]);

  // Group fixtures by date
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
      {/* League selector */}
      <div className="mb-5">
        <label className="block mb-1.5 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
          League
        </label>
        <select
          value={selectedLeagueId}
          onChange={(e) => setSelectedLeagueId(e.target.value)}
          className="w-full rounded-xl border border-ps-border bg-ps-surface px-3 py-2.5 text-sm font-semibold text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-amber/40 focus:border-ps-amber transition-colors"
        >
          {LEAGUE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mb-4 rounded-xl border border-ps-red/30 bg-ps-red/10 px-4 py-3 text-sm font-semibold text-ps-red">
          {saveError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center text-sm text-ps-text-ter font-semibold">
          Loading fixtures…
        </div>
      )}

      {/* Load error */}
      {!loading && loadError && (
        <div className="py-8 text-center text-sm text-ps-text-ter font-semibold">
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
                const currentPick = predictions[fixture.external_event_id];
                const isSaving = saving[fixture.external_event_id] ?? false;
                const isRace = RACE_SPORTS.has(fixture.sport);
                const isLocked = new Date(fixture.start_time) <= now;
                const [home, away] = fixture.participants;
                const hasTeams = Boolean(home && away);

                return (
                  <div
                    key={fixture.external_event_id}
                    className={`rounded-2xl border bg-ps-surface p-4 shadow-[0_1px_2px_rgba(40,30,20,0.04)] transition-colors ${
                      currentPick ? "border-ps-amber/40" : "border-ps-border"
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        {hasTeams ? (
                          <p className="text-sm font-bold text-ps-text leading-snug">
                            {home}{" "}
                            <span className="font-normal text-ps-text-ter text-xs">vs</span>{" "}
                            {away}
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-ps-text leading-snug">
                            {fixture.event_name}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono text-ps-text-ter">
                            {formatTime(fixture.start_time)}
                          </span>
                          <SportPill sport={toSportKey(fixture.sport)} size="sm" />
                          {fixture.competition_name && (
                            <span className="rounded-full bg-ps-chip px-1.5 py-px text-[10px] font-semibold text-ps-text-ter truncate max-w-[140px]">
                              {fixture.competition_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {currentPick && (
                        <span className="shrink-0 rounded-full bg-ps-green-soft px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase text-ps-green">
                          Picked
                        </span>
                      )}
                    </div>

                    {/* Prediction area */}
                    {isLocked ? (
                      <p className="text-[11px] font-semibold text-ps-text-ter">
                        Fixture started — no more picks
                      </p>
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
                      /* Race sports without a participant list — text input */
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
                          className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:outline-none focus:ring-2 focus:ring-ps-amber/40 focus:border-ps-amber"
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

                    {/* Current pick reminder */}
                    {currentPick && !isLocked && (
                      <p className="mt-2.5 text-[11px] font-semibold text-ps-text-ter">
                        Your pick:{" "}
                        <span className="font-extrabold text-ps-text">
                          {currentPick === "home"
                            ? (home ?? currentPick)
                            : currentPick === "away"
                            ? (away ?? currentPick)
                            : currentPick}
                        </span>{" "}
                        — tap another to change
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
  );
}
