import { WC2026_KNOCKOUT_ROUNDS } from "@/lib/bracket/adapters/fifa-world-cup-2026";

/**
 * Bracket tree per Articles 12.7-12.11 of the WC 2026 Regulations. Each
 * later-round slot's two feeders are explicit because FIFA's mapping is
 * non-sequential (e.g. R16-1 = W74+W77, not W73+W74). Mechanical 2n-1, 2n
 * would be wrong here. Source of truth: shared between BracketWizard and
 * the embedded KO editor in /wc/picks/[windowId].
 */
const KNOCKOUT_FEEDERS: Record<string, [string, string]> = {
  // R16 (Article 12.7) — M89..M96
  r16_m1: ["r32_m2", "r32_m5"],   // M89 = W74 v W77
  r16_m2: ["r32_m1", "r32_m3"],   // M90 = W73 v W75
  r16_m3: ["r32_m4", "r32_m6"],   // M91 = W76 v W78
  r16_m4: ["r32_m7", "r32_m8"],   // M92 = W79 v W80
  r16_m5: ["r32_m11", "r32_m12"], // M93 = W83 v W84
  r16_m6: ["r32_m9", "r32_m10"],  // M94 = W81 v W82
  r16_m7: ["r32_m14", "r32_m16"], // M95 = W86 v W88
  r16_m8: ["r32_m13", "r32_m15"], // M96 = W85 v W87
  // QF (Article 12.8) — M97..M100
  qf_m1: ["r16_m1", "r16_m2"], // M97 = W89 v W90
  qf_m2: ["r16_m5", "r16_m6"], // M98 = W93 v W94
  qf_m3: ["r16_m3", "r16_m4"], // M99 = W91 v W92
  qf_m4: ["r16_m7", "r16_m8"], // M100 = W95 v W96
  // SF (Article 12.9) — M101..M102
  sf_m1: ["qf_m1", "qf_m2"], // M101 = W97 v W98
  sf_m2: ["qf_m3", "qf_m4"], // M102 = W99 v W100
  // Final (Article 12.11) — M104
  final: ["sf_m1", "sf_m2"],
};

export function feedersFor(slotId: string): string[] {
  return KNOCKOUT_FEEDERS[slotId] ?? [];
}

export function resolveAllKnockoutMatchups(
  r32: Record<string, { home: string; away: string }>,
  picks: Record<string, { winner: string }>,
): Record<string, { home: string; away: string }> {
  const all: Record<string, { home: string; away: string }> = { ...r32 };

  const laterRounds = [
    WC2026_KNOCKOUT_ROUNDS[1], // r16
    WC2026_KNOCKOUT_ROUNDS[2], // qf
    WC2026_KNOCKOUT_ROUNDS[3], // sf
    WC2026_KNOCKOUT_ROUNDS[4], // final
  ];

  for (const round of laterRounds) {
    for (const slotId of round.slotIds) {
      const [homeFeeder, awayFeeder] = feedersFor(slotId);
      all[slotId] = {
        home: picks[homeFeeder]?.winner ?? "",
        away: picks[awayFeeder]?.winner ?? "",
      };
    }
  }

  return all;
}

export function getSFLoser(
  sfSlot: string,
  picks: Record<string, { winner: string }>,
  matchups: Record<string, { home: string; away: string }>,
): string {
  const winner = picks[sfSlot]?.winner;
  if (!winner) return "";
  const matchup = matchups[sfSlot];
  if (!matchup) return "";
  if (matchup.home && winner === matchup.home) return matchup.away;
  if (matchup.away && winner === matchup.away) return matchup.home;
  return "";
}

/**
 * Mutates `picks` in place. When a pick changes, any downstream slot that
 * referenced the old winner is invalidated (and so on transitively) so the
 * bracket stays internally consistent.
 */
export function clearDownstreamPicks(
  picks: Record<string, { winner: string }>,
  changedSlot: string,
): void {
  const allRounds = WC2026_KNOCKOUT_ROUNDS;
  for (const round of allRounds) {
    for (const slotId of round.slotIds) {
      const feeders = feedersFor(slotId);
      if (!feeders.includes(changedSlot)) continue;
      const existing = picks[slotId]?.winner;
      if (!existing) continue;
      const fw = feeders.map((f) => picks[f]?.winner);
      if (existing !== fw[0] && existing !== fw[1]) {
        delete picks[slotId];
        clearDownstreamPicks(picks, slotId);
      }
    }
  }
}

export function slotIdsForRound(
  roundKey: "r32" | "r16" | "qf" | "sf" | "final",
): string[] {
  switch (roundKey) {
    case "r32":
      return WC2026_KNOCKOUT_ROUNDS[0].slotIds;
    case "r16":
      return WC2026_KNOCKOUT_ROUNDS[1].slotIds;
    case "qf":
      return WC2026_KNOCKOUT_ROUNDS[2].slotIds;
    case "sf":
      return WC2026_KNOCKOUT_ROUNDS[3].slotIds;
    case "final":
      return WC2026_KNOCKOUT_ROUNDS[4].slotIds;
  }
}
