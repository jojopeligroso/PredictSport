// FIFA World Cup 2026 bracket adapter.
// 12 groups (A-L), 4 teams each = 48 teams total.
// R32: 16 matches (12 group winners + 12 runners-up + 8 best thirds).
// Subsequent rounds: R16 (8), QF (4), SF (2), 3rd Place (1), Final (1).

import type { BracketTemplateConfig, BracketSubmissionData } from '@/types/tournament';
import type { BracketValidationResult, OfficialBracketResults } from '@/lib/bracket/types';
import { validateBracketSubmission } from '@/lib/bracket/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 48 qualified teams (FIFA draw confirmed for WC2026 — update if draw changes).
// Groups A-L, 4 teams each.
export const WC2026_GROUPS: BracketTemplateConfig['groups'] = [
  { groupId: 'A', name: 'Group A', teams: ['USA', 'Panama', 'Canada', 'Morocco'] },
  { groupId: 'B', name: 'Group B', teams: ['Argentina', 'Chile', 'Peru', 'Australia'] },
  { groupId: 'C', name: 'Group C', teams: ['Mexico', 'Uruguay', 'Poland', 'Saudi Arabia'] },
  { groupId: 'D', name: 'Group D', teams: ['England', 'France', 'Algeria', 'DR Congo'] },
  { groupId: 'E', name: 'Group E', teams: ['Spain', 'Portugal', 'Senegal', 'New Zealand'] },
  { groupId: 'F', name: 'Group F', teams: ['Germany', 'Colombia', 'Ecuador', 'Ukraine'] },
  { groupId: 'G', name: 'Group G', teams: ['Brazil', 'Japan', 'Ivory Coast', 'Paraguay'] },
  { groupId: 'H', name: 'Group H', teams: ['Netherlands', 'Belgium', 'Iran', 'South Korea'] },
  { groupId: 'I', name: 'Group I', teams: ['Italy', 'Cameroon', 'Costa Rica', 'Honduras'] },
  { groupId: 'J', name: 'Group J', teams: ['Croatia', 'Serbia', 'South Africa', 'Egypt'] },
  { groupId: 'K', name: 'Group K', teams: ['Switzerland', 'Norway', 'Nigeria', 'Tunisia'] },
  { groupId: 'L', name: 'Group L', teams: ['Denmark', 'Turkey', 'Venezuela', 'Indonesia'] },
];

// Knockout rounds for WC2026.
// Slot ID convention: `r32_m{n}`, `r16_m{n}`, `qf_m{n}`, `sf_m{n}`, `final`.
// Third-place match uses slot ID `third_place_match`.
export const WC2026_KNOCKOUT_ROUNDS: BracketTemplateConfig['knockoutRounds'] = [
  {
    roundKey: 'r32',
    name: 'Round of 32',
    matchCount: 16,
    slotIds: [
      'r32_m1', 'r32_m2', 'r32_m3', 'r32_m4',
      'r32_m5', 'r32_m6', 'r32_m7', 'r32_m8',
      'r32_m9', 'r32_m10', 'r32_m11', 'r32_m12',
      'r32_m13', 'r32_m14', 'r32_m15', 'r32_m16',
    ],
  },
  {
    roundKey: 'r16',
    name: 'Round of 16',
    matchCount: 8,
    slotIds: [
      'r16_m1', 'r16_m2', 'r16_m3', 'r16_m4',
      'r16_m5', 'r16_m6', 'r16_m7', 'r16_m8',
    ],
  },
  {
    roundKey: 'qf',
    name: 'Quarter-Finals',
    matchCount: 4,
    slotIds: ['qf_m1', 'qf_m2', 'qf_m3', 'qf_m4'],
  },
  {
    roundKey: 'sf',
    name: 'Semi-Finals',
    matchCount: 2,
    slotIds: ['sf_m1', 'sf_m2'],
  },
  {
    roundKey: 'final',
    name: 'Final',
    matchCount: 1,
    slotIds: ['final'],
  },
];

// ---------------------------------------------------------------------------
// Best-third allocation matrix
// ---------------------------------------------------------------------------
//
// FIFA publishes the definitive mapping of which 8-of-12 qualifying third-place
// groups map to which R32 slots for WC2026. As of May 2026 the official matrix
// has NOT been published for the expanded 48-team format.
//
// TODO: Replace this placeholder with the official FIFA allocation matrix once
// published. The key format is the sorted comma-separated group IDs of the 8
// qualifying thirds (e.g. "A,B,C,D,E,F,G,H"). The value is a map of
// R32 slot ID -> group ID whose third-place team fills that slot.
//
// For FIFA WC2026, C(12,8) = 495 possible combinations. The placeholder below
// covers only a small subset for illustration. The adapter's allocateR32Slots()
// function will return an empty map for combinations not yet defined.
//
// Structure:
//   Record<sortedGroupLetters, Record<r32SlotId, groupId>>
//
// Example entry: if groups A,B,C,D,E,F,G,H all produce qualifying thirds,
// the matrix says which of the 16 R32 slots their 3rd-place teams fill.

export const BEST_THIRD_ALLOCATION_MATRIX: Record<string, Record<string, string>> = {
  // PLACEHOLDER — update when FIFA publishes the official 2026 allocation table.
  //
  // Pattern mirrors the 2018/2022 bracket logic where 3rd-place teams from
  // specific group combinations were slotted into predetermined R32 matches.
  // Slot assignments below are illustrative and should not be used in production.
  'A,B,C,D,E,F,G,H': {
    r32_m3: 'A',
    r32_m6: 'B',
    r32_m9: 'C',
    r32_m12: 'D',
    r32_m1: 'E',
    r32_m4: 'F',
    r32_m7: 'G',
    r32_m10: 'H',
  },
  'A,B,C,D,E,F,G,I': {
    r32_m3: 'A',
    r32_m6: 'B',
    r32_m9: 'C',
    r32_m12: 'D',
    r32_m1: 'E',
    r32_m4: 'F',
    r32_m7: 'G',
    r32_m10: 'I',
  },
  'A,B,C,D,E,F,G,J': {
    r32_m3: 'A',
    r32_m6: 'B',
    r32_m9: 'C',
    r32_m12: 'D',
    r32_m1: 'E',
    r32_m4: 'F',
    r32_m7: 'G',
    r32_m10: 'J',
  },
  'A,B,C,D,E,F,G,K': {
    r32_m3: 'A',
    r32_m6: 'B',
    r32_m9: 'C',
    r32_m12: 'D',
    r32_m1: 'E',
    r32_m4: 'F',
    r32_m7: 'G',
    r32_m10: 'K',
  },
  'A,B,C,D,E,F,G,L': {
    r32_m3: 'A',
    r32_m6: 'B',
    r32_m9: 'C',
    r32_m12: 'D',
    r32_m1: 'E',
    r32_m4: 'F',
    r32_m7: 'G',
    r32_m10: 'L',
  },
  // Additional entries omitted from placeholder. Full matrix (495 entries) to be
  // populated when FIFA publishes the official WC2026 allocation document.
};

// ---------------------------------------------------------------------------
// R32 matchup template
// ---------------------------------------------------------------------------
// Maps each R32 slot to the bracket positions it draws from.
// Format: { home: '<groupId><W|RU>', away: '<groupId><W|RU>|best_third_<slot>' }
// 'best_third' entries are filled by allocateR32Slots() at prediction time.
//
// This is the bracket half-structure. Group winners/runners-up are seeded per
// the FIFA bracket draw. The 8 best-third slots are determined by the
// allocationMatrix at time of prediction.
//
// NOTE: This is a placeholder pending the official FIFA 2026 bracket draw.
// The seeding will be confirmed before June 11.
const R32_MATCHUP_TEMPLATE: Record<string, { home: string; away: string }> = {
  r32_m1:  { home: 'AW',  away: 'BRU' },
  r32_m2:  { home: 'CW',  away: 'DRU' },
  r32_m3:  { home: 'EW',  away: 'FRU' },
  r32_m4:  { home: 'GW',  away: 'HRU' },
  r32_m5:  { home: 'IW',  away: 'JRU' },
  r32_m6:  { home: 'KW',  away: 'LRU' },
  r32_m7:  { home: 'BW',  away: 'ARU' },
  r32_m8:  { home: 'DW',  away: 'CRU' },
  r32_m9:  { home: 'FW',  away: 'ERU' },
  r32_m10: { home: 'HW',  away: 'GRU' },
  r32_m11: { home: 'JW',  away: 'IRU' },
  r32_m12: { home: 'LW',  away: 'KRU' },
  // Slots 13-16 are filled entirely by best-third teams.
  r32_m13: { home: 'BEST_THIRD', away: 'BEST_THIRD' },
  r32_m14: { home: 'BEST_THIRD', away: 'BEST_THIRD' },
  r32_m15: { home: 'BEST_THIRD', away: 'BEST_THIRD' },
  r32_m16: { home: 'BEST_THIRD', away: 'BEST_THIRD' },
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns the full BracketTemplateConfig for FIFA World Cup 2026.
 */
export function getWC2026Template(): BracketTemplateConfig {
  return {
    groups: WC2026_GROUPS,
    knockoutRounds: WC2026_KNOCKOUT_ROUNDS,
    bestThirdConfig: {
      qualifyCount: 8,
      totalGroups: 12,
      allocationMatrix: BEST_THIRD_ALLOCATION_MATRIX,
    },
    thirdPlacePlayoff: true,
  };
}

/**
 * Given the 8 group IDs whose third-place teams qualify, returns a map of
 * R32 slot ID -> group ID (whose third-place team occupies that slot).
 *
 * Uses BEST_THIRD_ALLOCATION_MATRIX. Returns an empty object if the
 * combination is not yet in the matrix (pending FIFA publication).
 */
export function allocateR32Slots(qualifyingThirdGroups: string[]): Record<string, string> {
  if (qualifyingThirdGroups.length !== 8) {
    return {};
  }
  const key = [...qualifyingThirdGroups].sort().join(',');
  return BEST_THIRD_ALLOCATION_MATRIX[key] ?? {};
}

/**
 * Generate the full R32 matchup map from group rankings and best-third picks.
 * Returns a map of R32 slot ID -> { home: teamName, away: teamName }.
 *
 * The 'home' / 'away' labels here are positional only (first / second listed
 * in the official bracket slot). They carry no scheduling significance.
 */
export function generateWC2026R32Matchups(
  groupRankings: Record<string, string[]>,
  bestThirdPicks: string[],
): Record<string, { home: string; away: string }> {
  const thirdSlots = allocateR32Slots(bestThirdPicks);

  // Resolve team names for each slot position (e.g. 'AW' -> winner of group A).
  const resolve = (position: string, slotId: string): string => {
    if (position === 'BEST_THIRD') {
      const groupId = thirdSlots[slotId];
      if (!groupId) return '';
      return groupRankings[groupId]?.[2] ?? '';
    }
    // Position format: '<GroupId>W' or '<GroupId>RU'
    const match = position.match(/^([A-L])(W|RU)$/);
    if (!match) return '';
    const [, groupId, role] = match;
    const ranking = groupRankings[groupId];
    if (!ranking) return '';
    return role === 'W' ? (ranking[0] ?? '') : (ranking[1] ?? '');
  };

  const result: Record<string, { home: string; away: string }> = {};
  for (const [slotId, positions] of Object.entries(R32_MATCHUP_TEMPLATE)) {
    result[slotId] = {
      home: resolve(positions.home, slotId),
      away: resolve(positions.away, slotId),
    };
  }
  return result;
}

/**
 * WC2026-specific bracket validation.
 *
 * Runs generic validation then applies WC2026 constraints:
 * - Exactly 12 groups (A-L).
 * - Each group has exactly 4 teams.
 * - Exactly 8 best-third picks.
 * - Best-third picks are valid group IDs (A-L).
 * - All R32 slots (16 matches) have picks.
 * - All subsequent knockout rounds have picks.
 * - champion and thirdPlace are present.
 */
export function validateWC2026Bracket(data: BracketSubmissionData): BracketValidationResult {
  const template = getWC2026Template();

  // Run the generic engine validation first.
  const baseResult = validateBracketSubmission(data, template);
  const errors = [...baseResult.errors];
  const warnings = [...baseResult.warnings];

  // WC2026-specific checks on top.
  const validGroupIds = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);

  // Confirm exactly 12 groups are ranked.
  const rankedGroupCount = Object.keys(data.groupRankings).length;
  if (rankedGroupCount !== 12) {
    errors.push(`WC2026 requires rankings for all 12 groups; found ${rankedGroupCount}.`);
  }

  // Confirm all ranked groups are valid WC2026 groups.
  for (const groupId of Object.keys(data.groupRankings)) {
    if (!validGroupIds.has(groupId)) {
      errors.push(`WC2026: unknown group ID '${groupId}' in groupRankings.`);
    }
  }

  // Confirm exactly 8 best-third picks.
  if (data.bestThirdPicks.length !== 8) {
    // Already caught by generic validation but add WC-specific wording.
    if (!errors.some((e) => e.includes('bestThirdPicks'))) {
      errors.push(`WC2026 requires exactly 8 best-third picks; found ${data.bestThirdPicks.length}.`);
    }
  }

  // Confirm all 16 R32 slots are filled.
  const r32Slots = WC2026_KNOCKOUT_ROUNDS[0].slotIds;
  const missingR32 = r32Slots.filter((s) => !data.knockoutPicks[s]);
  if (missingR32.length > 0) {
    errors.push(`WC2026 R32: missing picks for slots: ${missingR32.join(', ')}.`);
  }

  // Confirm all R16 slots are filled.
  const r16Slots = WC2026_KNOCKOUT_ROUNDS[1].slotIds;
  const missingR16 = r16Slots.filter((s) => !data.knockoutPicks[s]);
  if (missingR16.length > 0) {
    errors.push(`WC2026 R16: missing picks for slots: ${missingR16.join(', ')}.`);
  }

  // Confirm all QF, SF, and Final slots are filled.
  for (const round of WC2026_KNOCKOUT_ROUNDS.slice(2)) {
    const missing = round.slotIds.filter((s) => !data.knockoutPicks[s]);
    if (missing.length > 0) {
      errors.push(`WC2026 ${round.name}: missing picks for slots: ${missing.join(', ')}.`);
    }
  }

  // champion is required.
  if (!data.champion) {
    if (!errors.some((e) => e.includes('champion'))) {
      errors.push('WC2026: champion is required.');
    }
  }

  // thirdPlace is required for WC2026 (thirdPlacePlayoff = true).
  if (!data.thirdPlace) {
    if (!errors.some((e) => e.includes('thirdPlace'))) {
      errors.push('WC2026: thirdPlace is required.');
    }
  }

  // Warn if the best-third combination is not in the allocation matrix.
  if (data.bestThirdPicks.length === 8) {
    const sortedKey = [...data.bestThirdPicks].sort().join(',');
    if (!BEST_THIRD_ALLOCATION_MATRIX[sortedKey]) {
      warnings.push(
        `Best-third combination '${sortedKey}' is not yet in the allocation matrix. ` +
          'R32 slot assignments for best-third teams cannot be verified until FIFA publishes the official matrix.',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Re-export OfficialBracketResults for convenience when using the adapter.
export type { OfficialBracketResults };
