/**
 * FIFA World Cup 2026 — knockout-stage fixture slots (32 matches).
 *
 * Source: MLSsoccer.com (city-by-city schedule). Teams are placeholder labels
 * — they only resolve once the group stage finishes. The `city` is fixed (FIFA
 * has assigned each slot to a specific stadium) so we can colour fixture cards
 * before the bracket fills in.
 *
 * Times are UTC. Where FIFA has only confirmed the date (not the kick-off),
 * we record midday UTC and tag `kickoffConfirmed: false`.
 */

import type { HostCitySlug } from "@/lib/wc/host-cities";

export type WCKnockoutStage =
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "3RD"
  | "FINAL";

export interface WCKnockoutFixture {
  /** Match number — stable identifier across the 32 knockout matches. */
  matchNumber: number;
  stage: WCKnockoutStage;
  /** Placeholder until the group stage resolves. e.g. "Winner Group A". */
  home: string;
  /** Placeholder until the group stage resolves. */
  away: string;
  kickoffUtc: string;
  kickoffConfirmed: boolean;
  city: HostCitySlug;
}

// Sourced from MLSsoccer.com city schedule. Midday UTC is a stand-in until
// FIFA publishes kickoff times; replace with confirmed times when available.
export const WC2026_KNOCKOUT_FIXTURES: WCKnockoutFixture[] = [
  // ── Round of 32 (16 matches) ─────────────────────────────────────────────
  { matchNumber: 73, stage: 'R32', home: 'Runner-up A', away: 'Runner-up B',          kickoffUtc: '2026-06-28T20:00:00Z', kickoffConfirmed: false, city: 'los-angeles' },
  { matchNumber: 74, stage: 'R32', home: 'Winner E',    away: '3rd-place',            kickoffUtc: '2026-06-29T16:00:00Z', kickoffConfirmed: false, city: 'boston' },
  { matchNumber: 75, stage: 'R32', home: 'Winner C',    away: 'Runner-up F',          kickoffUtc: '2026-06-29T20:00:00Z', kickoffConfirmed: false, city: 'houston' },
  { matchNumber: 76, stage: 'R32', home: 'Winner I',    away: '3rd-place',            kickoffUtc: '2026-06-30T20:00:00Z', kickoffConfirmed: false, city: 'new-york-new-jersey' },
  { matchNumber: 77, stage: 'R32', home: 'Runner-up E', away: 'Runner-up I',          kickoffUtc: '2026-06-30T22:00:00Z', kickoffConfirmed: false, city: 'dallas' },
  { matchNumber: 78, stage: 'R32', home: 'Winner A',    away: '3rd-place',            kickoffUtc: '2026-06-30T16:00:00Z', kickoffConfirmed: false, city: 'mexico-city' },
  { matchNumber: 79, stage: 'R32', home: 'Winner L',    away: '3rd-place',            kickoffUtc: '2026-07-01T20:00:00Z', kickoffConfirmed: false, city: 'atlanta' },
  { matchNumber: 80, stage: 'R32', home: 'Winner D',    away: '3rd-place',            kickoffUtc: '2026-07-01T22:00:00Z', kickoffConfirmed: false, city: 'san-francisco-bay-area' },
  { matchNumber: 81, stage: 'R32', home: 'Winner G',    away: '3rd-place',            kickoffUtc: '2026-07-01T20:00:00Z', kickoffConfirmed: false, city: 'seattle' },
  { matchNumber: 82, stage: 'R32', home: 'Runner-up K', away: 'Runner-up L',          kickoffUtc: '2026-07-02T22:00:00Z', kickoffConfirmed: false, city: 'toronto' },
  { matchNumber: 83, stage: 'R32', home: 'Winner B',    away: '3rd-place',            kickoffUtc: '2026-07-02T22:00:00Z', kickoffConfirmed: false, city: 'vancouver' },
  { matchNumber: 84, stage: 'R32', home: 'Winner H',    away: 'Runner-up J',          kickoffUtc: '2026-07-02T20:00:00Z', kickoffConfirmed: false, city: 'los-angeles' },
  { matchNumber: 85, stage: 'R32', home: 'Winner J',    away: 'Runner-up H',          kickoffUtc: '2026-07-03T20:00:00Z', kickoffConfirmed: false, city: 'miami' },
  { matchNumber: 86, stage: 'R32', home: 'Winner K',    away: '3rd-place',            kickoffUtc: '2026-07-03T22:00:00Z', kickoffConfirmed: false, city: 'kansas-city' },
  { matchNumber: 87, stage: 'R32', home: 'Runner-up D', away: 'Runner-up G',          kickoffUtc: '2026-07-03T20:00:00Z', kickoffConfirmed: false, city: 'dallas' },
  { matchNumber: 88, stage: 'R32', home: 'Winner F',    away: 'Runner-up C',          kickoffUtc: '2026-06-29T22:00:00Z', kickoffConfirmed: false, city: 'monterrey' },

  // ── Round of 16 (8 matches) ──────────────────────────────────────────────
  { matchNumber: 89, stage: 'R16', home: 'W73',  away: 'W75', kickoffUtc: '2026-07-04T20:00:00Z', kickoffConfirmed: false, city: 'houston' },
  { matchNumber: 90, stage: 'R16', home: 'W74',  away: 'W77', kickoffUtc: '2026-07-04T22:00:00Z', kickoffConfirmed: false, city: 'philadelphia' },
  { matchNumber: 91, stage: 'R16', home: 'W76',  away: 'W78', kickoffUtc: '2026-07-05T22:00:00Z', kickoffConfirmed: false, city: 'new-york-new-jersey' },
  { matchNumber: 92, stage: 'R16', home: 'W79',  away: 'W80', kickoffUtc: '2026-07-05T20:00:00Z', kickoffConfirmed: false, city: 'mexico-city' },
  { matchNumber: 93, stage: 'R16', home: 'W81',  away: 'W82', kickoffUtc: '2026-07-06T22:00:00Z', kickoffConfirmed: false, city: 'seattle' },
  { matchNumber: 94, stage: 'R16', home: 'W83',  away: 'W84', kickoffUtc: '2026-07-06T20:00:00Z', kickoffConfirmed: false, city: 'dallas' },
  { matchNumber: 95, stage: 'R16', home: 'W85',  away: 'W87', kickoffUtc: '2026-07-07T22:00:00Z', kickoffConfirmed: false, city: 'vancouver' },
  { matchNumber: 96, stage: 'R16', home: 'W86',  away: 'W88', kickoffUtc: '2026-07-07T20:00:00Z', kickoffConfirmed: false, city: 'atlanta' },

  // ── Quarter-finals (4 matches) ───────────────────────────────────────────
  { matchNumber: 97, stage: 'QF',  home: 'W89',  away: 'W90', kickoffUtc: '2026-07-09T20:00:00Z', kickoffConfirmed: false, city: 'boston' },
  { matchNumber: 98, stage: 'QF',  home: 'W93',  away: 'W94', kickoffUtc: '2026-07-10T20:00:00Z', kickoffConfirmed: false, city: 'los-angeles' },
  { matchNumber: 99, stage: 'QF',  home: 'W91',  away: 'W92', kickoffUtc: '2026-07-11T20:00:00Z', kickoffConfirmed: false, city: 'miami' },
  { matchNumber: 100, stage: 'QF', home: 'W95',  away: 'W96', kickoffUtc: '2026-07-11T22:00:00Z', kickoffConfirmed: false, city: 'kansas-city' },

  // ── Semi-finals (2 matches) ──────────────────────────────────────────────
  { matchNumber: 101, stage: 'SF', home: 'W97',  away: 'W98',  kickoffUtc: '2026-07-14T20:00:00Z', kickoffConfirmed: false, city: 'dallas' },
  { matchNumber: 102, stage: 'SF', home: 'W99',  away: 'W100', kickoffUtc: '2026-07-15T20:00:00Z', kickoffConfirmed: false, city: 'atlanta' },

  // ── Third place + Final ──────────────────────────────────────────────────
  { matchNumber: 103, stage: '3RD',   home: 'L101', away: 'L102', kickoffUtc: '2026-07-18T20:00:00Z', kickoffConfirmed: false, city: 'miami' },
  { matchNumber: 104, stage: 'FINAL', home: 'W101', away: 'W102', kickoffUtc: '2026-07-19T19:00:00Z', kickoffConfirmed: false, city: 'new-york-new-jersey' },
];
