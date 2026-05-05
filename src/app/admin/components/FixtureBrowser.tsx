"use client";

import { useState, useEffect, useCallback } from "react";
import type { Sport } from "@/lib/sports/types";
import type { NormalizedFixture } from "@/app/api/sports/fixtures/route";

// Re-export for use in AddEventForm
export type { NormalizedFixture };

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
      { id: "4346", label: "FA Cup", sport: "soccer" },
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
      { id: "4337", label: "Eredivisie", sport: "soccer" },
      { id: "4338", label: "Pro League (Belgium)", sport: "soccer" },
      { id: "4336", label: "Super League (Greece)", sport: "soccer" },
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
    label: "Soccer — International",
    leagues: [
      { id: "4429", label: "FIFA World Cup", sport: "soccer" },
      { id: "4501", label: "Copa Libertadores", sport: "soccer" },
    ],
  },
  {
    label: "GAA",
    leagues: [
      { id: "5564", label: "All-Ireland Senior Football", sport: "gaa" },
      { id: "5566", label: "Connacht Senior Football", sport: "gaa" },
      { id: "5567", label: "Leinster Senior Football", sport: "gaa" },
      { id: "5568", label: "Munster Senior Football", sport: "gaa" },
      { id: "5569", label: "Ulster Senior Football", sport: "gaa" },
      { id: "5576", label: "Tailteann Cup", sport: "gaa" },
      { id: "5565", label: "All-Ireland Senior Hurling", sport: "gaa" },
      { id: "5570", label: "Munster Senior Hurling", sport: "gaa" },
      { id: "5571", label: "Leinster Senior Hurling", sport: "gaa" },
      { id: "5572", label: "Joe McDonagh Cup", sport: "gaa" },
      { id: "5573", label: "Christy Ring Cup", sport: "gaa" },
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
      { id: "4407", label: "MotoGP", sport: "formula_1" },
    ],
  },
  {
    label: "Combat Sports",
    leagues: [
      { id: "4443", label: "UFC", sport: "soccer" },
    ],
  },
  {
    label: "Rugby",
    leagues: [
      { id: "4415", label: "Super League", sport: "rugby" },
      { id: "4416", label: "NRL", sport: "rugby" },
      { id: "4446", label: "United Rugby Championship", sport: "rugby" },
      { id: "4550", label: "Champions Cup", sport: "rugby" },
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
    label: "Snooker",
    leagues: [
      { id: "4555", label: "World Snooker", sport: "soccer" },
    ],
  },
  {
    label: "Darts",
    leagues: [
      { id: "4554", label: "PDC Darts", sport: "soccer" },
    ],
  },
  {
    label: "Cycling",
    leagues: [
      { id: "4465", label: "UCI World Tour", sport: "soccer" },
    ],
  },
  {
    label: "Golf",
    leagues: [
      { id: "4758", label: "European Tour", sport: "golf" },
    ],
  },
  {
    label: "Cricket — International",
    leagues: [
      { id: "4844", label: "Test Match Series", sport: "soccer" },
      { id: "4801", label: "ODI Series", sport: "soccer" },
      { id: "4979", label: "T20I Series", sport: "soccer" },
      { id: "4575", label: "Cricket World Cup", sport: "soccer" },
      { id: "5587", label: "ICC Champions Trophy", sport: "soccer" },
      { id: "5103", label: "ICC Men's T20 World Cup", sport: "soccer" },
      { id: "5100", label: "ICC World Test Championship", sport: "soccer" },
    ],
  },
  {
    label: "Cricket — T20 Leagues",
    leagues: [
      { id: "4460", label: "Indian Premier League (IPL)", sport: "soccer" },
      { id: "4461", label: "Big Bash League", sport: "soccer" },
      { id: "4463", label: "English T20 Blast", sport: "soccer" },
      { id: "5177", label: "The Hundred", sport: "soccer" },
      { id: "5176", label: "Caribbean Premier League", sport: "soccer" },
      { id: "5067", label: "Pakistan Super League", sport: "soccer" },
      { id: "5532", label: "SA20", sport: "soccer" },
      { id: "5175", label: "Lanka Premier League", sport: "soccer" },
      { id: "5174", label: "NZ Super Smash", sport: "soccer" },
      { id: "5490", label: "International League T20 (UAE)", sport: "soccer" },
      { id: "5401", label: "Major League Cricket (USA)", sport: "soccer" },
    ],
  },
  {
    label: "Cricket — Domestic",
    leagues: [
      { id: "4458", label: "County Championship Div 1", sport: "soccer" },
      { id: "4459", label: "County Championship Div 2", sport: "soccer" },
      { id: "5530", label: "Sheffield Shield", sport: "soccer" },
      { id: "5606", label: "Ireland Inter-Provincial T20", sport: "soccer" },
    ],
  },
];

const DEFAULT_LEAGUE_ID = "4328";

interface FixtureBrowserProps {
  onSelect: (fixture: NormalizedFixture) => void;
}

function formatFixtureDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Date TBC";
  return date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function FixtureRow({
  fixture,
  onSelect,
}: {
  fixture: NormalizedFixture;
  onSelect: (f: NormalizedFixture) => void;
}) {
  const [home, away] = fixture.participants;
  const hasTeams = home && away;

  return (
    <button
      type="button"
      onClick={() => onSelect(fixture)}
      className="group w-full rounded-md border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasTeams ? (
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {home}{" "}
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                vs
              </span>{" "}
              {away}
            </div>
          ) : (
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
              {fixture.event_name}
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{formatFixtureDate(fixture.start_time)}</span>
            {fixture.round && (
              <span className="text-zinc-400 dark:text-zinc-500">
                Round {fixture.round}
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-700 dark:text-zinc-300">
          Select
        </span>
      </div>
    </button>
  );
}

export function FixtureBrowser({ onSelect }: FixtureBrowserProps) {
  const [selectedLeagueId, setSelectedLeagueId] =
    useState<string>(DEFAULT_LEAGUE_ID);
  const [fixtures, setFixtures] = useState<NormalizedFixture[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache fetched fixtures per league to avoid redundant requests
  const [cache, setCache] = useState<Record<string, NormalizedFixture[]>>({});

  const fetchFixtures = useCallback(
    async (leagueId: string) => {
      if (cache[leagueId]) {
        setFixtures(cache[leagueId]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setFixtures([]);

      try {
        const res = await fetch(`/api/sports/fixtures?league=${leagueId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load fixtures");
          return;
        }
        const fetched: NormalizedFixture[] = data.fixtures ?? [];
        setCache((prev) => ({ ...prev, [leagueId]: fetched }));
        setFixtures(fetched);
      } catch {
        setError("Network error — could not load fixtures");
      } finally {
        setIsLoading(false);
      }
    },
    [cache]
  );

  // Fetch on mount and when league changes
  useEffect(() => {
    fetchFixtures(selectedLeagueId);
    // fetchFixtures identity changes when cache updates — include it but guard
    // against infinite loops via the cache check inside fetchFixtures itself.
  }, [selectedLeagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeagueChange = (id: string) => {
    setSelectedLeagueId(id);
    // fixtures will update via the effect above
  };

  return (
    <div className="space-y-3">
      {/* League selector */}
      <div>
        <label
          htmlFor="fixture-league"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Competition
        </label>
        <select
          id="fixture-league"
          value={selectedLeagueId}
          onChange={(e) => handleLeagueChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          {LEAGUE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Fixtures list */}
      <div>
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-400 dark:text-zinc-500">
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Loading fixtures...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
            <button
              type="button"
              onClick={() => {
                setCache((prev) => {
                  const next = { ...prev };
                  delete next[selectedLeagueId];
                  return next;
                });
                fetchFixtures(selectedLeagueId);
              }}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && fixtures.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            No upcoming fixtures found for this competition.
          </div>
        )}

        {!isLoading && !error && fixtures.length > 0 && (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
            {fixtures.map((fixture) => (
              <FixtureRow
                key={fixture.external_event_id}
                fixture={fixture}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
