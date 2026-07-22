/**
 * Winter-league team helpers — resolve a league's roster, slugify team names
 * for routing, and reduce the shared fixture catalogue (events) into real,
 * results-derived team statistics.
 *
 * Data provenance: the four winter leagues have NO centralised stats or roster
 * API (see src/lib/sports/providers/winter/*). Everything here is computed from
 * game results already in `events` — records, run differentials, splits,
 * streaks and head-to-head are therefore real; box-score-level stats (batting/
 * pitching lines, lineups) are not available and are surfaced as such by the UI
 * rather than fabricated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** League slug → the fixtures are all queried by this tournament blueprint. */
export const LIGA_SLUGS = ["lmp", "lvbp", "lidom", "lbprc"] as const;
export type LigaSlug = (typeof LIGA_SLUGS)[number];

/** Fold accents and punctuation to a stable URL slug. Reversible via the roster. */
export function slugifyTeam(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface LeagueContext {
  tournamentId: string;
  tournamentName: string;
  seasonSlug: string;
  teams: string[];
}

/**
 * Resolve a league's active tournament and its roster (from the blueprint's
 * bracket template `leagueTeams`). Returns null when the blueprint is missing.
 */
export async function getLeagueContext(
  supabase: SupabaseClient,
  league: string,
): Promise<LeagueContext | null> {
  const { data: tournament } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, template_key")
    .like("slug", `${league}-%`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: {
      id: string;
      slug: string;
      name: string;
      template_key: string;
    } | null;
  };

  if (!tournament) return null;

  const { data: bracketTemplate } = await supabase
    .from("bracket_templates")
    .select("config")
    .eq("template_key", tournament.template_key)
    .limit(1)
    .maybeSingle();

  const teams =
    ((bracketTemplate?.config as Record<string, unknown> | null)?.[
      "leagueTeams"
    ] as string[] | undefined) ?? [];

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    seasonSlug: tournament.slug,
    teams,
  };
}

/** Split an event name ("Home v Away" / "Home vs Away") into its two sides. */
export function parseMatchup(
  eventName: string,
): { home: string; away: string } | null {
  const parts = eventName.split(/\s+vs?\.?\s+/i);
  if (parts.length !== 2) return null;
  return { home: parts[0].trim(), away: parts[1].trim() };
}

export interface TeamGame {
  id: string;
  date: string;
  opponent: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  won: boolean;
  margin: number;
}

export interface UpcomingGame {
  id: string;
  date: string;
  opponent: string;
  isHome: boolean;
}

export interface TeamStats {
  played: number;
  wins: number;
  losses: number;
  winPct: number; // 0..1
  runsFor: number;
  runsAgainst: number;
  runDiff: number;
  runsForPerGame: number;
  runsAgainstPerGame: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  last10: Array<"W" | "L">;
  streakType: "W" | "L" | null;
  streakLen: number;
  // Advanced / obscure — still fully results-derived.
  oneRunWins: number;
  oneRunLosses: number;
  blowoutWins: number; // won by 5+
  blowoutLosses: number; // lost by 5+
  shutoutsFor: number; // held opponent to 0
  shutoutsAgainst: number; // scored 0
  longestWinStreak: number;
  longestLossStreak: number;
  vsOpponent: Array<{ opponent: string; wins: number; losses: number }>;
}

interface EventRow {
  id: string;
  event_name: string;
  start_time: string;
  status: string;
  result_data: Record<string, unknown> | null;
}

/**
 * Reduce a set of the league's events to one team's schedule + statistics.
 * `resulted` games feed the stats; `upcoming`/`scheduled`/`live` feed the
 * schedule. Games this team is not part of are ignored.
 */
export function reduceTeamEvents(
  team: string,
  events: EventRow[],
): { stats: TeamStats; recent: TeamGame[]; upcoming: UpcomingGame[] } {
  const played: TeamGame[] = [];
  const upcoming: UpcomingGame[] = [];

  for (const ev of events) {
    const m = parseMatchup(ev.event_name);
    if (!m) continue;
    const isHome = m.home === team;
    const isAway = m.away === team;
    if (!isHome && !isAway) continue;
    const opponent = isHome ? m.away : m.home;

    if (ev.status === "resulted" && ev.result_data) {
      const home = Number(ev.result_data["home"] ?? NaN);
      const away = Number(ev.result_data["away"] ?? NaN);
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const teamScore = isHome ? home : away;
      const oppScore = isHome ? away : home;
      played.push({
        id: ev.id,
        date: ev.start_time,
        opponent,
        isHome,
        teamScore,
        oppScore,
        won: teamScore > oppScore,
        margin: Math.abs(teamScore - oppScore),
      });
    } else if (["upcoming", "scheduled", "live"].includes(ev.status)) {
      upcoming.push({ id: ev.id, date: ev.start_time, opponent, isHome });
    }
  }

  // Chronological for streaks; recent list is reverse.
  played.sort((a, b) => a.date.localeCompare(b.date));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  let wins = 0,
    losses = 0,
    runsFor = 0,
    runsAgainst = 0,
    homeWins = 0,
    homeLosses = 0,
    awayWins = 0,
    awayLosses = 0,
    oneRunWins = 0,
    oneRunLosses = 0,
    blowoutWins = 0,
    blowoutLosses = 0,
    shutoutsFor = 0,
    shutoutsAgainst = 0;
  let longestWinStreak = 0,
    longestLossStreak = 0;
  const vs = new Map<string, { wins: number; losses: number }>();

  for (const g of played) {
    runsFor += g.teamScore;
    runsAgainst += g.oppScore;
    const rec = vs.get(g.opponent) ?? { wins: 0, losses: 0 };
    if (g.won) {
      wins++;
      if (g.isHome) homeWins++;
      else awayWins++;
      if (g.margin === 1) oneRunWins++;
      if (g.margin >= 5) blowoutWins++;
      if (g.oppScore === 0) shutoutsFor++;
      rec.wins++;
    } else {
      losses++;
      if (g.isHome) homeLosses++;
      else awayLosses++;
      if (g.margin === 1) oneRunLosses++;
      if (g.margin >= 5) blowoutLosses++;
      if (g.teamScore === 0) shutoutsAgainst++;
      rec.losses++;
    }
    vs.set(g.opponent, rec);
  }

  // Current + longest streaks — single clean chronological pass.
  let curType: "W" | "L" | null = null;
  let curLen = 0;
  for (const g of played) {
    const r: "W" | "L" = g.won ? "W" : "L";
    if (r === curType) curLen++;
    else {
      curType = r;
      curLen = 1;
    }
    if (r === "W" && curLen > longestWinStreak) longestWinStreak = curLen;
    if (r === "L" && curLen > longestLossStreak) longestLossStreak = curLen;
  }

  const last10 = played.slice(-10).map((g) => (g.won ? "W" : "L") as "W" | "L");
  const recent = [...played].reverse();
  const played_n = played.length;

  const vsOpponent = Array.from(vs.entries())
    .map(([opponent, r]) => ({ opponent, wins: r.wins, losses: r.losses }))
    .sort((a, b) => a.opponent.localeCompare(b.opponent));

  const stats: TeamStats = {
    played: played_n,
    wins,
    losses,
    winPct: played_n > 0 ? wins / played_n : 0,
    runsFor,
    runsAgainst,
    runDiff: runsFor - runsAgainst,
    runsForPerGame: played_n > 0 ? runsFor / played_n : 0,
    runsAgainstPerGame: played_n > 0 ? runsAgainst / played_n : 0,
    homeWins,
    homeLosses,
    awayWins,
    awayLosses,
    last10,
    streakType: curType,
    streakLen: curLen,
    oneRunWins,
    oneRunLosses,
    blowoutWins,
    blowoutLosses,
    shutoutsFor,
    shutoutsAgainst,
    longestWinStreak,
    longestLossStreak,
    vsOpponent,
  };

  return { stats, recent, upcoming };
}
