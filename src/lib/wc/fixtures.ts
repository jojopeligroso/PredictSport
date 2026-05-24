/**
 * Single source of truth for WC2026 fixtures consumed by the /wc/results
 * page. Merges the group-stage fixture file (scripts/wc2026-group-fixtures.ts)
 * and the knockout placeholder file (scripts/wc2026-knockout-fixtures.ts) into
 * one chronologically sortable list keyed by `externalId` — the same key the
 * events table uses (`events.external_event_id`).
 */

import {
  WC2026_GROUP_FIXTURES,
  type WCGroupFixture,
} from "../../../scripts/wc2026-group-fixtures";
import {
  WC2026_KNOCKOUT_FIXTURES,
  type WCKnockoutFixture,
  type WCKnockoutStage,
} from "../../../scripts/wc2026-knockout-fixtures";
import type { HostCitySlug } from "./host-cities";

export type WcStage = "group" | WCKnockoutStage;

export interface WcFixture {
  /** Matches `events.external_event_id` once seeded. */
  externalId: string;
  stage: WcStage;
  /** Group A..L for group stage; null otherwise. */
  group: string | null;
  /** Matchday 1..3 for group stage; null otherwise. */
  matchday: number | null;
  /** FIFA knockout match number (73..104); null for group stage. */
  matchNumber: number | null;
  home: string;
  away: string;
  /** True for confirmed kickoff times; false for knockout midday-UTC placeholders. */
  kickoffConfirmed: boolean;
  /** UTC ISO 8601 — the source of truth for ordering and tz conversion. */
  kickoffUtc: string;
  city: HostCitySlug;
}

function fromGroup(f: WCGroupFixture): WcFixture {
  return {
    externalId: `wc2026-grp-${f.group}-md${f.matchday}-${f.matchInGroup}`,
    stage: "group",
    group: f.group,
    matchday: f.matchday,
    matchNumber: null,
    home: f.home,
    away: f.away,
    kickoffConfirmed: true,
    kickoffUtc: f.kickoffUtc,
    city: f.city,
  };
}

function fromKnockout(f: WCKnockoutFixture): WcFixture {
  return {
    externalId: `wc2026-ko-m${f.matchNumber}`,
    stage: f.stage,
    group: null,
    matchday: null,
    matchNumber: f.matchNumber,
    home: f.home,
    away: f.away,
    kickoffConfirmed: f.kickoffConfirmed,
    kickoffUtc: f.kickoffUtc,
    city: f.city,
  };
}

/**
 * All 104 WC2026 fixtures sorted by kickoff (earliest first).
 */
export const WC2026_FIXTURES: WcFixture[] = [
  ...WC2026_GROUP_FIXTURES.map(fromGroup),
  ...WC2026_KNOCKOUT_FIXTURES.map(fromKnockout),
].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
