/**
 * World Cup 2026 competition template.
 *
 * Contains everything needed to create a full WC prediction competition
 * in one shot: competition settings, 8 rounds, and a reference to the
 * 72 group fixtures. Used by POST /api/admin/competitions with
 * template: "world_cup_2026".
 */

export const WC2026_TEMPLATE = {
  competition: {
    name: "World Cup 2026",
    type: "fixed" as const,
    visibility: "private" as const,
    scoring_rules: {
      exact_score_bonus: 3,
      group_match_outcome: 2,
      knockout_advancing_team: 1,
    },
    allow_prediction_updates: true,
    lock_default_minutes: 10,
  },

  rounds: [
    { round_number: 1, name: "Group Matchday 1", status: "open" as const },
    { round_number: 2, name: "Group Matchday 2", status: "open" as const },
    { round_number: 3, name: "Group Matchday 3", status: "open" as const },
    { round_number: 4, name: "Round of 32", status: "draft" as const },
    { round_number: 5, name: "Round of 16", status: "draft" as const },
    { round_number: 6, name: "Quarter-Finals", status: "draft" as const },
    { round_number: 7, name: "Semi-Finals", status: "draft" as const },
    { round_number: 8, name: "Finals", status: "draft" as const },
  ],

  pointsWinner: 2,
  pointsExactScore: 3,
  lockOffsetMinutes: 10,
} as const;

/**
 * Minimal group fixture data for template seeding.
 * Sourced from scripts/wc2026-group-fixtures.ts (verified 2026-05-22).
 */
export interface WC2026GroupFixture {
  group: string;
  matchday: 1 | 2 | 3;
  matchInGroup: number;
  home: string;
  away: string;
  kickoffUtc: string;
}

export const WC2026_GROUP_FIXTURES: WC2026GroupFixture[] = [
  // Group A
  { group: 'A', matchday: 1, matchInGroup: 1, home: 'Mexico',        away: 'South Africa',  kickoffUtc: '2026-06-11T19:00:00Z' },
  { group: 'A', matchday: 1, matchInGroup: 2, home: 'South Korea',   away: 'Czechia',       kickoffUtc: '2026-06-12T02:00:00Z' },
  { group: 'A', matchday: 2, matchInGroup: 3, home: 'Czechia',       away: 'South Africa',  kickoffUtc: '2026-06-18T16:00:00Z' },
  { group: 'A', matchday: 2, matchInGroup: 4, home: 'Mexico',        away: 'South Korea',   kickoffUtc: '2026-06-19T01:00:00Z' },
  { group: 'A', matchday: 3, matchInGroup: 5, home: 'South Africa',  away: 'South Korea',   kickoffUtc: '2026-06-25T01:00:00Z' },
  { group: 'A', matchday: 3, matchInGroup: 6, home: 'Czechia',       away: 'Mexico',        kickoffUtc: '2026-06-25T01:00:00Z' },
  // Group B
  { group: 'B', matchday: 1, matchInGroup: 1, home: 'Canada',        away: 'Bosnia & Herzegovina', kickoffUtc: '2026-06-12T19:00:00Z' },
  { group: 'B', matchday: 1, matchInGroup: 2, home: 'Qatar',         away: 'Switzerland',   kickoffUtc: '2026-06-13T19:00:00Z' },
  { group: 'B', matchday: 2, matchInGroup: 3, home: 'Switzerland',   away: 'Bosnia & Herzegovina', kickoffUtc: '2026-06-18T19:00:00Z' },
  { group: 'B', matchday: 2, matchInGroup: 4, home: 'Canada',        away: 'Qatar',         kickoffUtc: '2026-06-18T22:00:00Z' },
  { group: 'B', matchday: 3, matchInGroup: 5, home: 'Switzerland',   away: 'Canada',        kickoffUtc: '2026-06-24T19:00:00Z' },
  { group: 'B', matchday: 3, matchInGroup: 6, home: 'Bosnia & Herzegovina', away: 'Qatar',  kickoffUtc: '2026-06-24T19:00:00Z' },
  // Group C
  { group: 'C', matchday: 1, matchInGroup: 1, home: 'Brazil',        away: 'Morocco',  kickoffUtc: '2026-06-13T22:00:00Z' },
  { group: 'C', matchday: 1, matchInGroup: 2, home: 'Haiti',         away: 'Scotland', kickoffUtc: '2026-06-14T01:00:00Z' },
  { group: 'C', matchday: 2, matchInGroup: 3, home: 'Scotland',      away: 'Morocco',  kickoffUtc: '2026-06-19T22:00:00Z' },
  { group: 'C', matchday: 2, matchInGroup: 4, home: 'Brazil',        away: 'Haiti',    kickoffUtc: '2026-06-20T00:30:00Z' },
  { group: 'C', matchday: 3, matchInGroup: 5, home: 'Morocco',       away: 'Haiti',    kickoffUtc: '2026-06-24T22:00:00Z' },
  { group: 'C', matchday: 3, matchInGroup: 6, home: 'Scotland',      away: 'Brazil',   kickoffUtc: '2026-06-24T22:00:00Z' },
  // Group D
  { group: 'D', matchday: 1, matchInGroup: 1, home: 'USA',       away: 'Paraguay',  kickoffUtc: '2026-06-13T01:00:00Z' },
  { group: 'D', matchday: 1, matchInGroup: 2, home: 'Australia', away: 'Turkiye',   kickoffUtc: '2026-06-14T04:00:00Z' },
  { group: 'D', matchday: 2, matchInGroup: 3, home: 'USA',       away: 'Australia', kickoffUtc: '2026-06-19T19:00:00Z' },
  { group: 'D', matchday: 2, matchInGroup: 4, home: 'Turkiye',   away: 'Paraguay',  kickoffUtc: '2026-06-20T03:00:00Z' },
  { group: 'D', matchday: 3, matchInGroup: 5, home: 'Turkiye',   away: 'USA',       kickoffUtc: '2026-06-26T02:00:00Z' },
  { group: 'D', matchday: 3, matchInGroup: 6, home: 'Paraguay',  away: 'Australia', kickoffUtc: '2026-06-26T02:00:00Z' },
  // Group E
  { group: 'E', matchday: 1, matchInGroup: 1, home: 'Germany',     away: 'Curacao',     kickoffUtc: '2026-06-14T17:00:00Z' },
  { group: 'E', matchday: 1, matchInGroup: 2, home: 'Ivory Coast', away: 'Ecuador',     kickoffUtc: '2026-06-14T23:00:00Z' },
  { group: 'E', matchday: 2, matchInGroup: 3, home: 'Germany',     away: 'Ivory Coast', kickoffUtc: '2026-06-20T20:00:00Z' },
  { group: 'E', matchday: 2, matchInGroup: 4, home: 'Ecuador',     away: 'Curacao',     kickoffUtc: '2026-06-21T00:00:00Z' },
  { group: 'E', matchday: 3, matchInGroup: 5, home: 'Curacao',     away: 'Ivory Coast', kickoffUtc: '2026-06-25T20:00:00Z' },
  { group: 'E', matchday: 3, matchInGroup: 6, home: 'Ecuador',     away: 'Germany',     kickoffUtc: '2026-06-25T20:00:00Z' },
  // Group F
  { group: 'F', matchday: 1, matchInGroup: 1, home: 'Netherlands', away: 'Japan',       kickoffUtc: '2026-06-14T20:00:00Z' },
  { group: 'F', matchday: 1, matchInGroup: 2, home: 'Sweden',      away: 'Tunisia',     kickoffUtc: '2026-06-15T02:00:00Z' },
  { group: 'F', matchday: 2, matchInGroup: 3, home: 'Netherlands', away: 'Sweden',      kickoffUtc: '2026-06-20T17:00:00Z' },
  { group: 'F', matchday: 2, matchInGroup: 4, home: 'Tunisia',     away: 'Japan',       kickoffUtc: '2026-06-21T04:00:00Z' },
  { group: 'F', matchday: 3, matchInGroup: 5, home: 'Tunisia',     away: 'Netherlands', kickoffUtc: '2026-06-25T23:00:00Z' },
  { group: 'F', matchday: 3, matchInGroup: 6, home: 'Japan',       away: 'Sweden',      kickoffUtc: '2026-06-25T23:00:00Z' },
  // Group G
  { group: 'G', matchday: 1, matchInGroup: 1, home: 'Belgium',     away: 'Egypt',       kickoffUtc: '2026-06-15T19:00:00Z' },
  { group: 'G', matchday: 1, matchInGroup: 2, home: 'Iran',        away: 'New Zealand', kickoffUtc: '2026-06-16T01:00:00Z' },
  { group: 'G', matchday: 2, matchInGroup: 3, home: 'Belgium',     away: 'Iran',        kickoffUtc: '2026-06-21T19:00:00Z' },
  { group: 'G', matchday: 2, matchInGroup: 4, home: 'New Zealand', away: 'Egypt',       kickoffUtc: '2026-06-22T01:00:00Z' },
  { group: 'G', matchday: 3, matchInGroup: 5, home: 'New Zealand', away: 'Belgium',     kickoffUtc: '2026-06-27T03:00:00Z' },
  { group: 'G', matchday: 3, matchInGroup: 6, home: 'Egypt',       away: 'Iran',        kickoffUtc: '2026-06-27T03:00:00Z' },
  // Group H
  { group: 'H', matchday: 1, matchInGroup: 1, home: 'Spain',        away: 'Cape Verde',   kickoffUtc: '2026-06-15T16:00:00Z' },
  { group: 'H', matchday: 1, matchInGroup: 2, home: 'Saudi Arabia', away: 'Uruguay',      kickoffUtc: '2026-06-15T22:00:00Z' },
  { group: 'H', matchday: 2, matchInGroup: 3, home: 'Spain',        away: 'Saudi Arabia', kickoffUtc: '2026-06-21T16:00:00Z' },
  { group: 'H', matchday: 2, matchInGroup: 4, home: 'Uruguay',      away: 'Cape Verde',   kickoffUtc: '2026-06-21T22:00:00Z' },
  { group: 'H', matchday: 3, matchInGroup: 5, home: 'Cape Verde',   away: 'Saudi Arabia', kickoffUtc: '2026-06-27T00:00:00Z' },
  { group: 'H', matchday: 3, matchInGroup: 6, home: 'Uruguay',      away: 'Spain',        kickoffUtc: '2026-06-27T00:00:00Z' },
  // Group I
  { group: 'I', matchday: 1, matchInGroup: 1, home: 'France',  away: 'Senegal', kickoffUtc: '2026-06-16T19:00:00Z' },
  { group: 'I', matchday: 1, matchInGroup: 2, home: 'Iraq',    away: 'Norway',  kickoffUtc: '2026-06-16T22:00:00Z' },
  { group: 'I', matchday: 2, matchInGroup: 3, home: 'France',  away: 'Iraq',    kickoffUtc: '2026-06-22T21:00:00Z' },
  { group: 'I', matchday: 2, matchInGroup: 4, home: 'Norway',  away: 'Senegal', kickoffUtc: '2026-06-23T00:00:00Z' },
  { group: 'I', matchday: 3, matchInGroup: 5, home: 'Norway',  away: 'France',  kickoffUtc: '2026-06-26T19:00:00Z' },
  { group: 'I', matchday: 3, matchInGroup: 6, home: 'Senegal', away: 'Iraq',    kickoffUtc: '2026-06-26T19:00:00Z' },
  // Group J
  { group: 'J', matchday: 1, matchInGroup: 1, home: 'Argentina', away: 'Algeria',   kickoffUtc: '2026-06-17T01:00:00Z' },
  { group: 'J', matchday: 1, matchInGroup: 2, home: 'Austria',   away: 'Jordan',    kickoffUtc: '2026-06-17T04:00:00Z' },
  { group: 'J', matchday: 2, matchInGroup: 3, home: 'Argentina', away: 'Austria',   kickoffUtc: '2026-06-22T17:00:00Z' },
  { group: 'J', matchday: 2, matchInGroup: 4, home: 'Jordan',    away: 'Algeria',   kickoffUtc: '2026-06-23T03:00:00Z' },
  { group: 'J', matchday: 3, matchInGroup: 5, home: 'Algeria',   away: 'Austria',   kickoffUtc: '2026-06-28T02:00:00Z' },
  { group: 'J', matchday: 3, matchInGroup: 6, home: 'Jordan',    away: 'Argentina', kickoffUtc: '2026-06-28T02:00:00Z' },
  // Group K
  { group: 'K', matchday: 1, matchInGroup: 1, home: 'Portugal',   away: 'DR Congo',   kickoffUtc: '2026-06-17T17:00:00Z' },
  { group: 'K', matchday: 1, matchInGroup: 2, home: 'Uzbekistan', away: 'Colombia',   kickoffUtc: '2026-06-18T02:00:00Z' },
  { group: 'K', matchday: 2, matchInGroup: 3, home: 'Portugal',   away: 'Uzbekistan', kickoffUtc: '2026-06-23T17:00:00Z' },
  { group: 'K', matchday: 2, matchInGroup: 4, home: 'Colombia',   away: 'DR Congo',   kickoffUtc: '2026-06-24T02:00:00Z' },
  { group: 'K', matchday: 3, matchInGroup: 5, home: 'Colombia',   away: 'Portugal',   kickoffUtc: '2026-06-27T23:30:00Z' },
  { group: 'K', matchday: 3, matchInGroup: 6, home: 'DR Congo',   away: 'Uzbekistan', kickoffUtc: '2026-06-27T23:30:00Z' },
  // Group L
  { group: 'L', matchday: 1, matchInGroup: 1, home: 'England', away: 'Croatia', kickoffUtc: '2026-06-17T20:00:00Z' },
  { group: 'L', matchday: 1, matchInGroup: 2, home: 'Ghana',   away: 'Panama',  kickoffUtc: '2026-06-17T23:00:00Z' },
  { group: 'L', matchday: 2, matchInGroup: 3, home: 'England', away: 'Ghana',   kickoffUtc: '2026-06-23T20:00:00Z' },
  { group: 'L', matchday: 2, matchInGroup: 4, home: 'Panama',  away: 'Croatia', kickoffUtc: '2026-06-23T23:00:00Z' },
  { group: 'L', matchday: 3, matchInGroup: 5, home: 'Panama',  away: 'England', kickoffUtc: '2026-06-27T21:00:00Z' },
  { group: 'L', matchday: 3, matchInGroup: 6, home: 'Croatia', away: 'Ghana',   kickoffUtc: '2026-06-27T21:00:00Z' },
];

/**
 * Compute daily lock times: group fixtures by UTC date within each matchday,
 * then set lock_time = earliest kickoff on that day - offset.
 */
export function computeWC2026DailyLockTimes(
  fixtures: WC2026GroupFixture[],
  offsetMinutes: number,
): Map<string, Date> {
  // Key: "matchday-YYYY-MM-DD", Value: earliest kickoff on that day within that matchday
  const byDayAndMatchday = new Map<string, Date>();
  for (const f of fixtures) {
    const start = new Date(f.kickoffUtc);
    const iso = start.toISOString().slice(0, 10);
    const key = `${f.matchday}-${iso}`;
    const existing = byDayAndMatchday.get(key);
    if (!existing || start < existing) {
      byDayAndMatchday.set(key, start);
    }
  }
  const dailyLocks = new Map<string, Date>();
  for (const [key, earliest] of byDayAndMatchday) {
    dailyLocks.set(key, new Date(earliest.getTime() - offsetMinutes * 60_000));
  }
  return dailyLocks;
}
