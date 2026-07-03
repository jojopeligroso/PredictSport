/**
 * Knockout bracket advancement — when a knockout result is confirmed,
 * propagate the winner (and loser for 3rd-place) into downstream fixture
 * event_names. Also updates prediction type options when both teams resolve.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Slot ↔ match-number mapping
// ---------------------------------------------------------------------------
// Slot IDs:  r32_m1..r32_m16, r16_m1..r16_m8, qf_m1..qf_m4, sf_m1..sf_m2, final
// Match nums: 73..88 (R32), 89..96 (R16), 97..100 (QF), 101..102 (SF), 103 (3RD), 104 (FINAL)

function slotToMatchNumber(slot: string): number {
  if (slot === "final") return 104;
  if (slot === "third_place_match") return 103;
  const m = slot.match(/^(r32|r16|qf|sf)_m(\d+)$/);
  if (!m) return 0;
  const offsets: Record<string, number> = { r32: 72, r16: 88, qf: 96, sf: 100 };
  return offsets[m[1]] + parseInt(m[2]);
}

function matchNumberToExtId(n: number): string {
  return `wc2026-ko-m${n}`;
}

// ---------------------------------------------------------------------------
// Advancement map: source slot → downstream slots that receive the winner/loser
// ---------------------------------------------------------------------------
// Built from KNOCKOUT_FEEDERS in wc2026-knockout-tree.ts. Each entry says:
// "The winner of slot X feeds into slot Y at position home/away."

interface Advancement {
  targetSlot: string;
  targetMatchNumber: number;
  position: "home" | "away";
  type: "winner" | "loser";
}

// KNOCKOUT_FEEDERS maps targetSlot → [homeFeeder, awayFeeder].
// We invert it: sourceSlot → [{target, position, type}]
const KNOCKOUT_FEEDERS: Record<string, [string, string]> = {
  r16_m1: ["r32_m2", "r32_m5"],
  r16_m2: ["r32_m1", "r32_m3"],
  r16_m3: ["r32_m4", "r32_m6"],
  r16_m4: ["r32_m7", "r32_m8"],
  r16_m5: ["r32_m11", "r32_m12"],
  r16_m6: ["r32_m9", "r32_m10"],
  r16_m7: ["r32_m14", "r32_m16"],
  r16_m8: ["r32_m13", "r32_m15"],
  qf_m1: ["r16_m1", "r16_m2"],
  qf_m2: ["r16_m5", "r16_m6"],
  qf_m3: ["r16_m3", "r16_m4"],
  qf_m4: ["r16_m7", "r16_m8"],
  sf_m1: ["qf_m1", "qf_m2"],
  sf_m2: ["qf_m3", "qf_m4"],
  final: ["sf_m1", "sf_m2"],
  // 3rd-place match gets the LOSERS of the semi-finals
  third_place_match: ["sf_m1", "sf_m2"],
};

// Invert: source slot → what it feeds
const ADVANCEMENT_MAP = new Map<string, Advancement[]>();

for (const [targetSlot, [homeFeeder, awayFeeder]] of Object.entries(KNOCKOUT_FEEDERS)) {
  const isThirdPlace = targetSlot === "third_place_match";
  const targetMatchNumber = slotToMatchNumber(targetSlot);

  for (const [feeder, position] of [
    [homeFeeder, "home"],
    [awayFeeder, "away"],
  ] as const) {
    if (!ADVANCEMENT_MAP.has(feeder)) ADVANCEMENT_MAP.set(feeder, []);
    ADVANCEMENT_MAP.get(feeder)!.push({
      targetSlot,
      targetMatchNumber,
      position,
      type: isThirdPlace ? "loser" : "winner",
    });
  }
}

// ---------------------------------------------------------------------------
// Match number → slot ID (reverse lookup)
// ---------------------------------------------------------------------------

function matchNumberToSlot(n: number): string | null {
  if (n === 104) return "final";
  if (n === 103) return "third_place_match";
  if (n >= 101 && n <= 102) return `sf_m${n - 100}`;
  if (n >= 97 && n <= 100) return `qf_m${n - 96}`;
  if (n >= 89 && n <= 96) return `r16_m${n - 88}`;
  if (n >= 73 && n <= 88) return `r32_m${n - 72}`;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * After a knockout event result is confirmed, update downstream fixture
 * event_names with the advancing team. Call from confirm-result and auto-resolve.
 *
 * Returns the list of updated fixture names for logging.
 */
export async function advanceKnockoutWinners(
  supabase: SupabaseClient,
  event: {
    event_name: string;
    external_event_id: string | null;
    result_data: Record<string, unknown> | null;
  },
): Promise<string[]> {
  const updated: string[] = [];

  // Parse match number from external_event_id
  const matchNumStr = event.external_event_id?.match(/wc2026-ko-m(\d+)/)?.[1];
  if (!matchNumStr) return updated;

  const matchNum = parseInt(matchNumStr);
  const sourceSlot = matchNumberToSlot(matchNum);
  if (!sourceSlot) return updated;

  const advancements = ADVANCEMENT_MAP.get(sourceSlot);
  if (!advancements || advancements.length === 0) return updated;

  // Extract winner from result_data
  const resultData = event.result_data;
  if (!resultData) return updated;

  const winner = resultData.winner as string | null;
  if (!winner) return updated;

  // Derive loser from event_name
  const parts = (event.event_name as string).split(/\s+vs?\s+/i);
  const homeTeam = parts[0]?.trim();
  const awayTeam = parts[1]?.trim();
  const loser = winner === homeTeam ? awayTeam : homeTeam;

  for (const adv of advancements) {
    const teamName = adv.type === "winner" ? winner : loser;
    if (!teamName) continue;

    const targetExtId = matchNumberToExtId(adv.targetMatchNumber);

    // Fetch the target event
    const { data: targetEvent } = await supabase
      .from("events")
      .select("id, event_name, is_bracket_placeholder, competition_id")
      .eq("external_event_id", targetExtId)
      .maybeSingle();

    if (!targetEvent) continue;

    // Replace the relevant slot in event_name
    const targetParts = (targetEvent.event_name as string).split(/\s+vs?\s+/i);
    let targetHome = targetParts[0]?.trim() ?? "";
    let targetAway = targetParts[1]?.trim() ?? "";

    if (adv.position === "home") {
      targetHome = teamName;
    } else {
      targetAway = teamName;
    }

    const newName = `${targetHome} vs ${targetAway}`;

    // Both resolved = no more W/L prefixes
    const bothResolved =
      !/^[WL]\d+$/.test(targetHome) &&
      !/^[WL]\d+$/.test(targetAway) &&
      !targetHome.includes("Winner") &&
      !targetHome.includes("Runner-up") &&
      !targetHome.includes("3rd") &&
      !targetAway.includes("Winner") &&
      !targetAway.includes("Runner-up") &&
      !targetAway.includes("3rd") &&
      targetHome !== "TBD" &&
      targetAway !== "TBD";

    const updatePayload: Record<string, unknown> = { event_name: newName };
    if (bothResolved) {
      updatePayload.is_bracket_placeholder = false;
    }

    const { error } = await supabase
      .from("events")
      .update(updatePayload)
      .eq("id", targetEvent.id);

    if (error) {
      console.error(`[advance] Failed to update ${targetExtId}: ${error.message}`);
      continue;
    }

    // When both teams are resolved, update the winner prediction type options
    if (bothResolved) {
      await supabase
        .from("event_prediction_types")
        .update({
          config: { options: [targetHome, targetAway, "Draw"] },
        })
        .eq("event_id", targetEvent.id)
        .eq("prediction_type", "winner");
    }

    updated.push(newName);
  }

  return updated;
}
