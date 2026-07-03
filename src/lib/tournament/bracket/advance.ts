/**
 * Knockout bracket advancement — when a knockout result is confirmed,
 * propagate the winner (and loser for 3rd-place) into downstream fixture
 * event_names. Also updates prediction type options when both teams resolve.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Slot ↔ external_event_id mapping
// ---------------------------------------------------------------------------
// DB uses: manual:wc2026-r32-{n}, manual:wc2026-r16-{n}, manual:wc2026-qf-{n},
//          manual:wc2026-sf-{n}, manual:wc2026-3rd-1, manual:wc2026-final-1

function slotToExtId(slot: string): string | null {
  if (slot === "final") return "manual:wc2026-final-1";
  if (slot === "third_place_match") return "manual:wc2026-3rd-1";
  const m = slot.match(/^(r32|r16|qf|sf)_m(\d+)$/);
  if (!m) return null;
  return `manual:wc2026-${m[1]}-${m[2]}`;
}

function extIdToSlot(extId: string): string | null {
  const m = extId.match(/^manual:wc2026-(r32|r16|qf|sf)-(\d+)$/);
  if (m) return `${m[1]}_m${m[2]}`;
  if (extId === "manual:wc2026-final-1") return "final";
  if (extId === "manual:wc2026-3rd-1") return "third_place_match";
  return null;
}

// ---------------------------------------------------------------------------
// Advancement map: source slot → downstream slots that receive the winner/loser
// ---------------------------------------------------------------------------

interface Advancement {
  targetSlot: string;
  position: "home" | "away";
  type: "winner" | "loser";
}

// KNOCKOUT_FEEDERS: targetSlot → [homeFeeder, awayFeeder]
// Matches the tree in wc2026-knockout-tree.ts
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
  third_place_match: ["sf_m1", "sf_m2"],
};

// Invert: source slot → what it feeds into
const ADVANCEMENT_MAP = new Map<string, Advancement[]>();

for (const [targetSlot, [homeFeeder, awayFeeder]] of Object.entries(KNOCKOUT_FEEDERS)) {
  const isThirdPlace = targetSlot === "third_place_match";

  for (const [feeder, position] of [
    [homeFeeder, "home"],
    [awayFeeder, "away"],
  ] as const) {
    if (!ADVANCEMENT_MAP.has(feeder)) ADVANCEMENT_MAP.set(feeder, []);
    ADVANCEMENT_MAP.get(feeder)!.push({
      targetSlot,
      position,
      type: isThirdPlace ? "loser" : "winner",
    });
  }
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

  if (!event.external_event_id) return updated;

  const sourceSlot = extIdToSlot(event.external_event_id);
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

    const targetExtId = slotToExtId(adv.targetSlot);
    if (!targetExtId) continue;

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

    // Both resolved when neither side is a placeholder
    const isPlaceholder = (s: string) =>
      /^[WL]\d+$/.test(s) || s === "TBD" || s.includes("Winner") ||
      s.includes("Runner-up") || s.includes("3rd");
    const bothResolved = !isPlaceholder(targetHome) && !isPlaceholder(targetAway);

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

    // When both teams are resolved, update prediction type options
    if (bothResolved) {
      // Update winner options
      await supabase
        .from("event_prediction_types")
        .update({
          config: { options: [targetHome, "Draw", targetAway] },
        })
        .eq("event_id", targetEvent.id)
        .eq("prediction_type", "winner");

      // Update h2h options (no draw for knockout advancement)
      await supabase
        .from("event_prediction_types")
        .update({
          config: { label: "Who goes through?", options: [targetHome, targetAway], allow_draw: false },
        })
        .eq("event_id", targetEvent.id)
        .eq("prediction_type", "head_to_head");
    }

    updated.push(newName);
  }

  return updated;
}
