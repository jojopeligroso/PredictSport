// Generic bracket prediction engine.
// Pure functions — no Supabase calls. All tournament-format knowledge lives in the template.

import type { BracketTemplateConfig, BracketSubmissionData } from '@/types/tournament';
import type {
  BracketValidationResult,
  BracketScoringResult,
  OfficialBracketResults,
} from '@/lib/bracket/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function err(errors: string[], msg: string): void {
  errors.push(msg);
}

function warn(warnings: string[], msg: string): void {
  warnings.push(msg);
}

/**
 * Collect the full set of teams that should be reachable in knockout slots,
 * given the user's group rankings and best-third picks.
 * Returns a map of groupId -> { first, second, third }.
 */
function resolveGroupQualifiers(
  groupRankings: Record<string, string[]>,
  bestThirdPicks: string[],
  template: BracketTemplateConfig,
): {
  winners: Record<string, string>;
  runnersUp: Record<string, string>;
  qualifiedThirds: Record<string, string>;
} {
  const winners: Record<string, string> = {};
  const runnersUp: Record<string, string> = {};
  const qualifiedThirds: Record<string, string> = {};

  for (const group of template.groups) {
    const ranking = groupRankings[group.groupId];
    if (!ranking || ranking.length < 2) continue;
    winners[group.groupId] = ranking[0];
    runnersUp[group.groupId] = ranking[1];
    if (bestThirdPicks.includes(group.groupId) && ranking[2]) {
      qualifiedThirds[group.groupId] = ranking[2];
    }
  }

  return { winners, runnersUp, qualifiedThirds };
}

/**
 * Derive which teams are eligible for the first knockout round, keyed by slot ID.
 * Uses the allocation matrix to place best-third teams into specific R32 slots.
 */
function deriveFirstRoundEligible(
  groupRankings: Record<string, string[]>,
  bestThirdPicks: string[],
  template: BracketTemplateConfig,
): Record<string, string[]> {
  const { winners, runnersUp, qualifiedThirds } = resolveGroupQualifiers(
    groupRankings,
    bestThirdPicks,
    template,
  );

  const eligible: Record<string, string[]> = {};

  // Build the R32 slot → participants mapping from the template's allocationMatrix.
  // The matrix is keyed by the sorted group-letter string of the qualifying thirds,
  // and maps to slot assignments.
  if (template.bestThirdConfig) {
    const sortedKey = [...bestThirdPicks].sort().join(',');
    const slotAssignments = template.bestThirdConfig.allocationMatrix[sortedKey];
    if (slotAssignments) {
      for (const [slotId, groupId] of Object.entries(slotAssignments)) {
        const team = qualifiedThirds[groupId];
        if (team) {
          eligible[slotId] = [...(eligible[slotId] ?? []), team];
        }
      }
    }
  }

  // Add winners and runners-up into slots.
  // Winners go to slots named `<groupId>_W` or the first knockout round's
  // slot structure. Since slot IDs are template-defined and the matrix covers
  // best thirds, we rely on the fact that the engine's slot-sensitive scoring
  // just checks which team was predicted in which slot.
  // The generator (generateKnockoutFromGroups) is responsible for building the
  // full slot → {home, away} map; the engine just validates picks are internally
  // consistent.
  for (const [groupId, team] of Object.entries(winners)) {
    const slotId = `r32_${groupId.toLowerCase()}_w`;
    eligible[slotId] = [team];
  }
  for (const [groupId, team] of Object.entries(runnersUp)) {
    const slotId = `r32_${groupId.toLowerCase()}_ru`;
    eligible[slotId] = [team];
  }

  return eligible;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a bracket submission against template constraints.
 *
 * Checks:
 * - All groups have rankings.
 * - Each group's ranking contains exactly the right teams (no missing, no extras).
 * - bestThirdPicks count matches template.bestThirdConfig.qualifyCount.
 * - bestThirdPicks are valid group IDs.
 * - Knockout picks reference teams that are reachable in those slots per group
 *   rankings and best-third selections.
 * - champion is the winner of the final slot.
 * - thirdPlace is present iff template.thirdPlacePlayoff is true.
 */
export function validateBracketSubmission(
  data: BracketSubmissionData,
  template: BracketTemplateConfig,
): BracketValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const groupIds = new Set(template.groups.map((g) => g.groupId));

  // --- Group rankings ---
  for (const group of template.groups) {
    const ranking = data.groupRankings[group.groupId];
    if (!ranking) {
      err(errors, `Group ${group.groupId} has no ranking.`);
      continue;
    }
    if (ranking.length !== group.teams.length) {
      err(
        errors,
        `Group ${group.groupId}: expected ${group.teams.length} teams, got ${ranking.length}.`,
      );
      continue;
    }
    const expected = new Set(group.teams);
    for (const team of ranking) {
      if (!expected.has(team)) {
        err(errors, `Group ${group.groupId}: unknown team '${team}' in ranking.`);
      }
    }
    const seen = new Set<string>();
    for (const team of ranking) {
      if (seen.has(team)) {
        err(errors, `Group ${group.groupId}: duplicate team '${team}' in ranking.`);
      }
      seen.add(team);
    }
  }

  // --- Best-third picks ---
  if (template.bestThirdConfig) {
    const { qualifyCount } = template.bestThirdConfig;
    if (data.bestThirdPicks.length !== qualifyCount) {
      err(
        errors,
        `bestThirdPicks must contain exactly ${qualifyCount} groups, got ${data.bestThirdPicks.length}.`,
      );
    }
    for (const groupId of data.bestThirdPicks) {
      if (!groupIds.has(groupId)) {
        err(errors, `bestThirdPicks contains unknown group ID '${groupId}'.`);
      }
    }
    const dupes = new Set<string>();
    const seen = new Set<string>();
    for (const g of data.bestThirdPicks) {
      if (seen.has(g)) dupes.add(g);
      seen.add(g);
    }
    for (const d of dupes) {
      err(errors, `bestThirdPicks contains duplicate group ID '${d}'.`);
    }
  } else if (data.bestThirdPicks.length > 0) {
    warn(warnings, 'bestThirdPicks provided but template has no bestThirdConfig.');
  }

  // --- Knockout picks: slot-sensitive reachability ---
  // Collect all teams the user has ranked in group stage.
  const allRankedTeams = new Set<string>();
  for (const ranking of Object.values(data.groupRankings)) {
    for (const team of ranking) allRankedTeams.add(team);
  }

  // Build the set of teams the user expects to qualify (winners, runners-up, qualifying thirds).
  const qualifyingTeams = new Set<string>();
  for (const group of template.groups) {
    const ranking = data.groupRankings[group.groupId];
    if (!ranking || ranking.length < 2) continue;
    qualifyingTeams.add(ranking[0]); // winner
    qualifyingTeams.add(ranking[1]); // runner-up
  }
  for (const groupId of data.bestThirdPicks) {
    const ranking = data.groupRankings[groupId];
    if (ranking && ranking[2]) qualifyingTeams.add(ranking[2]);
  }

  // Validate each knockout pick references a team that exists in the pool.
  if (template.knockoutRounds.length > 0) {
    const firstRound = template.knockoutRounds[0];
    for (const slotId of firstRound.slotIds) {
      const pick = data.knockoutPicks[slotId];
      if (!pick) {
        err(errors, `Missing knockout pick for slot '${slotId}'.`);
        continue;
      }
      if (!qualifyingTeams.has(pick.winner)) {
        err(
          errors,
          `Slot '${slotId}': team '${pick.winner}' is not in the qualifying pool from your group rankings.`,
        );
      }
    }

    // Validate subsequent rounds: the winner of each slot must have been picked in
    // a prior round that feeds into this slot. We track "who the user picked to
    // advance from each slot" and propagate forward.
    const advancingFromSlot: Record<string, string> = {};
    for (const slotId of firstRound.slotIds) {
      const pick = data.knockoutPicks[slotId];
      if (pick) advancingFromSlot[slotId] = pick.winner;
    }

    for (let i = 1; i < template.knockoutRounds.length; i++) {
      const round = template.knockoutRounds[i];
      // Each slot in this round corresponds to a pair of slots in the previous round.
      // Slot IDs follow the convention: round-level slots contain 2× the previous
      // round's advancement pool. We validate by checking that the picked winner
      // was a winner in some earlier slot (not slot-specific here — a full
      // slot-mapping would require the template to encode the bracket tree).
      // For strict slot-path validation the template adapter should use
      // validateWC2026Bracket(); here we do a weaker "team must have been picked
      // to advance somewhere" check.
      const advancedSoFar = new Set(Object.values(advancingFromSlot));
      for (const slotId of round.slotIds) {
        const pick = data.knockoutPicks[slotId];
        if (!pick) {
          err(errors, `Missing knockout pick for slot '${slotId}'.`);
          continue;
        }
        if (!advancedSoFar.has(pick.winner)) {
          err(
            errors,
            `Slot '${slotId}' (${round.name}): team '${pick.winner}' was not picked to advance from the previous round.`,
          );
        }
        advancingFromSlot[slotId] = pick.winner;
      }
    }
  }

  // --- Champion ---
  if (!data.champion) {
    err(errors, 'champion is required.');
  } else {
    // Champion must be the winner of the final slot.
    const finalRound = template.knockoutRounds[template.knockoutRounds.length - 1];
    if (finalRound && finalRound.slotIds.length === 1) {
      const finalSlotId = finalRound.slotIds[0];
      const finalPick = data.knockoutPicks[finalSlotId];
      if (finalPick && finalPick.winner !== data.champion) {
        err(
          errors,
          `champion '${data.champion}' does not match the winner picked in the final slot '${finalSlotId}' ('${finalPick.winner}').`,
        );
      }
    }
  }

  // --- Third place ---
  if (template.thirdPlacePlayoff && !data.thirdPlace) {
    err(errors, 'thirdPlace is required when template has thirdPlacePlayoff enabled.');
  }
  if (!template.thirdPlacePlayoff && data.thirdPlace) {
    warn(warnings, 'thirdPlace provided but template does not have thirdPlacePlayoff enabled.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Score a bracket against official results.
 *
 * Slot-sensitive: a team reaching the QF via the wrong bracket path is NOT
 * counted correct, because slotId encodes the path. Only which team was
 * predicted to win a specific slot matters. Penalties and method of advancement
 * (extra time, penalties, etc.) are irrelevant — only the advancing team counts.
 */
export function scoreBracket(
  submission: BracketSubmissionData,
  officialResults: OfficialBracketResults,
  template: BracketTemplateConfig,
): BracketScoringResult {
  const details: BracketScoringResult['details'] = [];
  let correctPicks = 0;
  let totalResolved = 0;
  let deadAtRound: string | undefined;
  let isDead = false;

  // --- Group rankings ---
  for (const group of template.groups) {
    const predicted = submission.groupRankings[group.groupId];
    const actual = officialResults.groupRankings[group.groupId];

    if (!actual) {
      // Group not yet resolved — no scoring yet.
      continue;
    }

    // Score each position in the group ranking as its own slot.
    for (let pos = 0; pos < group.teams.length; pos++) {
      const slotId = `group_${group.groupId}_pos${pos + 1}`;
      const predictedTeam = predicted?.[pos] ?? '';
      const actualTeam = actual[pos] ?? null;
      const correct = actualTeam !== null ? predictedTeam === actualTeam : null;

      if (correct !== null) {
        totalResolved++;
        if (correct) correctPicks++;
      }

      details.push({ slotId, predicted: predictedTeam, actual: actualTeam, correct });
    }
  }

  // --- Best-third picks ---
  if (template.bestThirdConfig) {
    const { qualifyingThirdGroups } = officialResults;
    // Only score if the official qualifying thirds have been determined.
    if (qualifyingThirdGroups.length === template.bestThirdConfig.qualifyCount) {
      const actualSet = new Set(qualifyingThirdGroups);
      for (const groupId of submission.bestThirdPicks) {
        const slotId = `best_third_${groupId}`;
        const actual = actualSet.has(groupId) ? groupId : null;
        // actual here is the groupId if it qualified, otherwise the groupId is wrong.
        const correct = actualSet.has(groupId);
        totalResolved++;
        if (correct) correctPicks++;
        details.push({
          slotId,
          predicted: groupId,
          actual: actual,
          correct,
        });
      }
    }
  }

  // --- Knockout picks ---
  // Process rounds in order so we can detect dead brackets at the earliest round.
  for (const round of template.knockoutRounds) {
    let roundHasElimination = false;

    for (const slotId of round.slotIds) {
      const predicted = submission.knockoutPicks[slotId]?.winner ?? '';
      const officialSlot = officialResults.knockoutResults[slotId];
      const actual = officialSlot?.winner ?? null;
      const correct = actual !== null ? predicted === actual : null;

      if (correct !== null) {
        totalResolved++;
        if (correct) correctPicks++;
      }

      // A bracket is dead when the predicted team lost in the slot they were
      // predicted to win — i.e. the result is resolved and the prediction is wrong.
      if (correct === false && !isDead) {
        isDead = true;
        roundHasElimination = true;
      }

      details.push({ slotId, predicted, actual, correct });
    }

    if (roundHasElimination && !deadAtRound) {
      deadAtRound = round.name;
    }
  }

  // --- Champion ---
  if (officialResults.champion) {
    const slotId = 'champion';
    const predicted = submission.champion;
    const actual = officialResults.champion;
    const correct = predicted === actual;
    totalResolved++;
    if (correct) correctPicks++;
    details.push({ slotId, predicted, actual, correct });

    if (!correct && !isDead) {
      isDead = true;
      deadAtRound = deadAtRound ?? 'Final';
    }
  }

  // --- Third place ---
  if (template.thirdPlacePlayoff && officialResults.thirdPlace && submission.thirdPlace) {
    const slotId = 'third_place';
    const predicted = submission.thirdPlace;
    const actual = officialResults.thirdPlace;
    const correct = predicted === actual;
    totalResolved++;
    if (correct) correctPicks++;
    details.push({ slotId, predicted, actual, correct });
  }

  return {
    status: isDead ? 'dead' : 'live',
    correctPicks,
    totalResolved,
    deadAtRound,
    details,
  };
}

/**
 * Returns true if the bracket is still alive (no eliminating mistakes yet).
 *
 * Dead = any knockout slot where the user's predicted team has already been
 * eliminated from that path. Group ranking errors do not kill a bracket.
 */
export function isBracketLive(
  submission: BracketSubmissionData,
  officialResults: OfficialBracketResults,
  template: BracketTemplateConfig,
): boolean {
  // Check knockout picks only — group stage errors don't kill a bracket.
  for (const round of template.knockoutRounds) {
    for (const slotId of round.slotIds) {
      const predicted = submission.knockoutPicks[slotId]?.winner;
      const officialSlot = officialResults.knockoutResults[slotId];
      if (!officialSlot || !predicted) continue;
      // Result is resolved and the wrong team was picked.
      if (officialSlot.winner !== predicted) return false;
    }
  }

  // Check champion.
  if (officialResults.champion && submission.champion !== officialResults.champion) {
    return false;
  }

  return true;
}

/**
 * Generate the first knockout round's slot → {home, away} matchups from group
 * outcomes. Uses template.bestThirdConfig.allocationMatrix for third-place slot
 * allocation. Returns only the first-round matchups; subsequent rounds are
 * derived dynamically as picks are made.
 *
 * The slot naming convention used here is:
 *   `r32_m{n}` where n is 1-based match number.
 *
 * The template's allocationMatrix maps sorted-group-letter keys to per-slot
 * team assignments. If no matrix entry exists for the given combination a
 * best-effort result is returned with only winners/runners-up filled in.
 */
export function generateKnockoutFromGroups(
  groupRankings: Record<string, string[]>,
  bestThirdPicks: string[],
  template: BracketTemplateConfig,
): Record<string, { home: string; away: string }> {
  if (template.knockoutRounds.length === 0) return {};

  const firstRound = template.knockoutRounds[0];
  const result: Record<string, { home: string; away: string }> = {};

  // Resolve qualifiers.
  const { winners, runnersUp, qualifiedThirds } = resolveGroupQualifiers(
    groupRankings,
    bestThirdPicks,
    template,
  );

  // Build the best-third slot assignments using the allocation matrix.
  const thirdSlotAssignments: Record<string, string> = {}; // slotId -> team
  if (template.bestThirdConfig && bestThirdPicks.length > 0) {
    const sortedKey = [...bestThirdPicks].sort().join(',');
    const slotAssignments = template.bestThirdConfig.allocationMatrix[sortedKey];
    if (slotAssignments) {
      for (const [slotId, groupId] of Object.entries(slotAssignments)) {
        const team = qualifiedThirds[groupId];
        if (team) thirdSlotAssignments[slotId] = team;
      }
    }
  }

  // Build slot matchups. The template's firstRound.slotIds encodes the bracket
  // structure. Each slot ID is used as-is. The adapter is responsible for
  // providing slot IDs that encode which groups feed into which match.
  //
  // Convention: first-round slot IDs are of the form `r32_<groupA>w_<groupB>ru`
  // or similar. Since the engine is generic, we map participants by the
  // allocationMatrix and group winner/runner-up assignments per slot.
  //
  // For a fully generic engine the template must supply a matchup map.
  // Here we fall back to a positional pairing if no matrix covers best thirds.

  // Build a flat list of all qualifying teams in order:
  // [G-A 1st, G-B 2nd, G-C 1st, ...] — ordering is template-defined via slotIds.
  // Since we can't infer the bracket tree from slot IDs alone, we rely on
  // template.bestThirdConfig.allocationMatrix to encode full slot participants.
  // For the winner/runner-up assignments, the WC2026 adapter encodes these in the
  // slot IDs themselves (e.g. "r32_m1" = Group A winner vs Group B runner-up).

  // We iterate over the first round's slots and use any available data:
  for (const slotId of firstRound.slotIds) {
    // The allocation matrix may have full matchup data in a separate structure.
    // Here we handle the WC2026-style where the adapter populates matchups
    // directly using allocateR32Slots() and this function is called after that.
    // The generic engine records what we know: if a slot has a third-place team
    // assigned, pair it with the home team from the template's encoded bracket.
    const thirdTeam = thirdSlotAssignments[slotId];

    // Parse slot ID to infer home/away for winner/runner-up slots.
    // WC2026 format: "r32_<GID>w" or "r32_<GID>ru" or "r32_m{n}" (match number).
    const winnerMatch = slotId.match(/^r32_([a-l])w$/i);
    const ruMatch = slotId.match(/^r32_([a-l])ru$/i);

    if (winnerMatch) {
      const groupId = winnerMatch[1].toUpperCase();
      const team = winners[groupId] ?? '';
      // Winner slots need a partner — handled by the adapter building full matchups.
      result[slotId] = { home: team, away: thirdTeam ?? '' };
    } else if (ruMatch) {
      const groupId = ruMatch[1].toUpperCase();
      const team = runnersUp[groupId] ?? '';
      result[slotId] = { home: team, away: thirdTeam ?? '' };
    } else if (thirdTeam) {
      result[slotId] = { home: thirdTeam, away: '' };
    }
    // Slots not matched by these patterns are filled in by the adapter.
  }

  return result;
}
