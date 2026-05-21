import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassificationMembership, StandingRow } from "@/types/tournament";
import type { Prediction } from "@/types/database";
import { computeFormatStandings } from "../standings-snapshot";

// ============================================================
// Exported types for Format Classification scoring
// ============================================================

export interface GroupStandingRow extends StandingRow {
  group_id: string;
  group_position: number;
}

export interface ThirdPlaceRow extends StandingRow {
  group_id: string;
  group_number: number;
  group_name: string;
}

export interface BestThirdTableData {
  rows: ThirdPlaceRow[];
  qualifyCount: number;
  qualifyingCutoff: number | null; // Points threshold for the qualifying line (null if not deterministic)
  qualifyingLine: number; // Index (0-based) at which qualification ends
}

// ============================================================
// Compute standings within a prediction group for a specific stage
// Points reset per stage (stage-local)
// ============================================================

export async function computeFormatGroupStandings(
  supabase: SupabaseClient,
  groupId: string,
  stageId: string
): Promise<GroupStandingRow[]> {
  // Fetch group members
  const { data: groupMembers, error: gmError } = await supabase
    .from("format_group_memberships")
    .select("user_id, status")
    .eq("group_id", groupId);

  if (gmError) throw new Error(`Failed to fetch group members: ${gmError.message}`);
  if (!groupMembers || groupMembers.length === 0) return [];

  // Fetch classification_id from group
  const { data: group, error: groupError } = await supabase
    .from("format_prediction_groups")
    .select("classification_id")
    .eq("id", groupId)
    .single();

  if (groupError) throw new Error(`Failed to fetch group: ${groupError.message}`);

  const classificationId: string = group.classification_id;

  // Fetch classification_memberships so we can get the full membership status
  const userIds = groupMembers.map((m: { user_id: string }) => m.user_id);

  const { data: memberships, error: mbError } = await supabase
    .from("classification_memberships")
    .select("*")
    .eq("classification_id", classificationId)
    .in("user_id", userIds);

  if (mbError) throw new Error(`Failed to fetch classification memberships: ${mbError.message}`);

  // Fetch events linked to this classification + stage
  const { data: classificationEvents, error: ceError } = await supabase
    .from("classification_events")
    .select("event_id")
    .eq("classification_id", classificationId)
    .eq("sporting_stage_id", stageId)
    .eq("counts_for_scoring", true)
    .not("event_id", "is", null);

  if (ceError) throw new Error(`Failed to fetch classification events: ${ceError.message}`);

  const eventIds = (classificationEvents ?? [])
    .map((ce: { event_id: string | null }) => ce.event_id)
    .filter((id): id is string => id !== null);

  if (eventIds.length === 0) {
    // No events scored for this stage yet — return zero-point standings
    const membershipList = (memberships ?? []) as ClassificationMembership[];
    return membershipList.map((m, idx) => ({
      rank: idx + 1,
      user_id: m.user_id,
      display_name: "",
      points: 0,
      status: m.status,
      eliminated: m.status === "eliminated" || m.status === "dead",
      tie_break_values: { exact_hits: 0, outcome_hits: 0 },
      movement: null,
      metadata: {},
      group_id: groupId,
      group_position: idx + 1,
    }));
  }

  // Fetch stage-local predictions for group members
  const { data: predictions, error: predError } = await supabase
    .from("predictions")
    .select("user_id, points_awarded, is_correct, prediction_type, submitted_at, event_id")
    .in("user_id", userIds)
    .in("event_id", eventIds)
    .order("submitted_at", { ascending: true });

  if (predError) throw new Error(`Failed to fetch predictions: ${predError.message}`);

  const membershipList = (memberships ?? []) as ClassificationMembership[];
  const standingRows = computeFormatStandings(
    (predictions ?? []) as Partial<Prediction>[],
    membershipList,
    stageId
  );

  return standingRows.map((row, idx) => ({
    ...row,
    group_id: groupId,
    group_position: idx + 1,
  }));
}

// ============================================================
// Rank all third-place finishers across groups for a stage
// Only includes thirds from 4-player groups (best-third pool).
// 3-player thirds never qualify; 5-player thirds auto-qualify.
// ============================================================

export async function computeBestThirdRanking(
  supabase: SupabaseClient,
  classificationId: string,
  stageId: string
): Promise<ThirdPlaceRow[]> {
  // Fetch all groups with their target_size for filtering
  const { data: groups, error: groupsError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);
  if (!groups || groups.length === 0) return [];

  const thirdPlaceRows: ThirdPlaceRow[] = [];

  // Only 4-player groups contribute to the best-third pool
  const eligibleGroups = (groups as { id: string; group_name: string; group_number: number; target_size: number }[])
    .filter((g) => g.target_size === 4);

  for (const group of eligibleGroups) {
    const groupStandings = await computeFormatGroupStandings(supabase, group.id, stageId);

    // Third place = rank 3 (index 2 after sorting)
    const sortedByRank = groupStandings.sort((a, b) => a.rank - b.rank);
    const thirdPlace = sortedByRank[2];

    if (thirdPlace) {
      thirdPlaceRows.push({
        ...thirdPlace,
        group_id: group.id,
        group_number: group.group_number,
        group_name: group.group_name,
      });
    }
  }

  // Sort third-place finishers using the same tie-break hierarchy
  thirdPlaceRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aExact = a.tie_break_values?.exact_hits ?? 0;
    const bExact = b.tie_break_values?.exact_hits ?? 0;
    if (bExact !== aExact) return bExact - aExact;
    const aOutcome = a.tie_break_values?.outcome_hits ?? 0;
    const bOutcome = b.tie_break_values?.outcome_hits ?? 0;
    if (bOutcome !== aOutcome) return bOutcome - aOutcome;
    // Group number as deterministic fallback (lower group number = earlier)
    return a.group_number - b.group_number;
  });

  return thirdPlaceRows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

// ============================================================
// Build data for the best-third qualification table UI
// ============================================================

export function getBestThirdTableData(
  thirdPlaceRows: ThirdPlaceRow[],
  qualifyCount: number
): BestThirdTableData {
  const qualifyingLine = Math.min(qualifyCount, thirdPlaceRows.length);

  const qualifyingRow = thirdPlaceRows[qualifyCount - 1];
  const firstNonQualifying = thirdPlaceRows[qualifyCount];

  // Determine if there's a deterministic points cutoff
  let qualifyingCutoff: number | null = null;
  if (qualifyingRow && firstNonQualifying) {
    if (qualifyingRow.points !== firstNonQualifying.points) {
      qualifyingCutoff = qualifyingRow.points;
    }
  } else if (qualifyingRow) {
    qualifyingCutoff = qualifyingRow.points;
  }

  return {
    rows: thirdPlaceRows,
    qualifyCount,
    qualifyingCutoff,
    qualifyingLine,
  };
}
