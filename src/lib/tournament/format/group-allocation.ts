import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormatPredictionGroup, FormatGroupMembership } from "@/types/tournament";

// ============================================================
// Group composition result — exported for testing/reuse
// ============================================================

export interface GroupComposition {
  groups3: number; // number of 3-player groups
  groups4: number; // number of 4-player groups
  groups5: number; // number of 5-player groups
  totalGroups: number;
  autoQualifiers: number; // top 2 from each + thirds from 5-player
  bestThirdSlots: number; // additional best-third from 4-player groups
  totalSurvivors: number;
}

/**
 * Compute the group composition that reaches the survivor target.
 *
 * Exhaustive search over all valid (g3, g4, g5) where 3*g3 + 4*g4 + 5*g5 = N.
 * Qualification rules:
 * - Top 2 from every group auto-qualify
 * - Third-place from 5-player groups auto-qualifies
 * - Third-place from 4-player groups eligible for best-third selection
 * - Third-place from 3-player groups never qualifies
 *
 * Prefers most 4-player groups (fairest), then fewest total groups.
 *
 * @param entrantCount Total entrants (must be >= 3)
 * @param survivorTarget Number of survivors after group stage
 * @returns Group composition details
 */
export function computeGroupComposition(
  entrantCount: number,
  survivorTarget: number
): GroupComposition {
  if (entrantCount < 3) {
    throw new Error(`Need at least 3 entrants, got ${entrantCount}`);
  }
  return solveGroupComposition(entrantCount, survivorTarget);
}

/**
 * Find the optimal (g3, g4, g5) group composition.
 * Prefers more 4-player groups (fairest). Among solutions that hit the target,
 * minimises the number of 3 and 5-player groups.
 */
function solveGroupComposition(
  entrantCount: number,
  survivorTarget: number
): GroupComposition {
  let best: GroupComposition | null = null;

  // g5 can range from 0 to floor(N/5)
  const maxG5 = Math.floor(entrantCount / 5);

  for (let g5 = 0; g5 <= maxG5; g5++) {
    const remaining = entrantCount - 5 * g5;
    // remaining = 3*g3 + 4*g4
    // g3 can be 0..floor(remaining/3)
    const maxG3 = Math.floor(remaining / 3);

    for (let g3 = 0; g3 <= maxG3; g3++) {
      const leftover = remaining - 3 * g3;
      if (leftover % 4 !== 0) continue;
      const g4 = leftover / 4;

      const totalGroups = g3 + g4 + g5;
      if (totalGroups === 0) continue;

      // Qualification: top 2 from each + thirds from 5-player auto-qualify
      const autoQualifiers = totalGroups * 2 + g5;
      const bestThirdSlots = survivorTarget - autoQualifiers;

      // best-third must come from 4-player groups only
      if (bestThirdSlots < 0 || bestThirdSlots > g4) continue;

      const candidate: GroupComposition = {
        groups3: g3,
        groups4: g4,
        groups5: g5,
        totalGroups,
        autoQualifiers,
        bestThirdSlots,
        totalSurvivors: survivorTarget,
      };

      // Prefer: most 4-player groups (fairest), then fewest total groups
      if (
        !best ||
        candidate.groups4 > best.groups4 ||
        (candidate.groups4 === best.groups4 && candidate.totalGroups < best.totalGroups)
      ) {
        best = candidate;
      }
    }
  }

  if (!best) {
    throw new Error(
      `No valid group composition for ${entrantCount} entrants with ${survivorTarget} survivors`
    );
  }

  return best;
}

// ============================================================
// Allocate entrants into prediction groups (random draw)
// Target-aware: chooses group sizes to reach the survivor target.
// ============================================================

export async function allocatePredictionGroups(
  supabase: SupabaseClient,
  classificationId: string,
  survivorTarget: number
): Promise<FormatPredictionGroup[]> {
  // Fetch all active members for this classification
  const { data: memberships, error: mbError } = await supabase
    .from("classification_memberships")
    .select("user_id")
    .eq("classification_id", classificationId)
    .eq("status", "active");

  if (mbError) throw new Error(`Failed to fetch memberships: ${mbError.message}`);

  const userIds = (memberships ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];

  // Fetch competition_id for group rows
  const { data: cls, error: clsError } = await supabase
    .from("classifications")
    .select("competition_id")
    .eq("id", classificationId)
    .single();

  if (clsError) throw new Error(`Failed to fetch classification: ${clsError.message}`);

  // Compute target-aware group composition
  const composition = computeGroupComposition(userIds.length, survivorTarget);

  // Cryptographically random Fisher-Yates shuffle
  const shuffled = cryptoShuffle([...userIds]);

  // Build group chunks according to composition
  const chunks = distributeIntoGroups(shuffled, composition);

  // Delete any existing groups + memberships (regeneration path)
  await supabase
    .from("format_prediction_groups")
    .delete()
    .eq("classification_id", classificationId);

  // Insert new groups
  const groupInserts = chunks.map((chunk, idx) => ({
    classification_id: classificationId,
    competition_id: cls.competition_id,
    group_name: `Group ${numberToLetter(idx + 1)}`,
    group_number: idx + 1,
    target_size: chunk.length,
    metadata: {},
  }));

  const { data: groups, error: groupError } = await supabase
    .from("format_prediction_groups")
    .insert(groupInserts)
    .select("*");

  if (groupError) throw new Error(`Failed to insert prediction groups: ${groupError.message}`);

  // Insert group memberships
  const membershipInserts = chunks.flatMap((chunk, idx) => {
    const group = (groups as FormatPredictionGroup[])[idx];
    return chunk.map((userId, position) => ({
      group_id: group.id,
      classification_id: classificationId,
      user_id: userId,
      seed_position: position + 1,
      status: "active" as const,
    }));
  });

  const { error: memberError } = await supabase
    .from("format_group_memberships")
    .insert(membershipInserts);

  if (memberError) throw new Error(`Failed to insert group memberships: ${memberError.message}`);

  return groups as FormatPredictionGroup[];
}

// ============================================================
// Add late entrant to the smallest group
// ============================================================

export async function addLateEntrant(
  supabase: SupabaseClient,
  classificationId: string,
  userId: string
): Promise<FormatGroupMembership> {
  // Find current active group sizes
  const { data: rawGroups, error: groupError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number, competition_id, status")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupError) throw new Error(`Failed to fetch groups: ${groupError.message}`);

  // Filter active groups in app code — safe when status column doesn't exist yet
  const groups = (rawGroups ?? []).filter(
    (g) => !g.status || g.status === "active"
  );
  if (groups.length === 0) {
    throw new Error("No prediction groups exist for this classification");
  }

  // Check if user is already in a group
  const { data: existingMembership } = await supabase
    .from("format_group_memberships")
    .select("id")
    .eq("classification_id", classificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    throw new Error("User is already in a group for this classification");
  }

  const { data: mbData, error: mbError } = await supabase
    .from("format_group_memberships")
    .select("group_id")
    .eq("classification_id", classificationId);

  if (mbError) throw new Error(`Failed to fetch group memberships: ${mbError.message}`);

  // Count members per group
  const groupList = groups as { id: string; group_number: number; competition_id: string }[];
  const sizeCounts = new Map<string, number>();
  for (const g of groupList) {
    sizeCounts.set(g.id, 0);
  }
  for (const m of mbData ?? []) {
    const current = sizeCounts.get(m.group_id) ?? 0;
    sizeCounts.set(m.group_id, current + 1);
  }

  // Fill groups to standard size of 4 before creating new groups.
  // Mod-4 remainder (1-3 members in newest group) is resolved at lock time.
  const underFour = Array.from(sizeCounts.entries())
    .filter(([, count]) => count < 4);

  let chosenGroupId: string;

  if (underFour.length > 0) {
    // Always fill the most recently created group first
    // to preserve competitive integrity of earlier groups
    const underFourGroups = underFour
      .map(([id]) => groupList.find((g) => g.id === id)!)
      .sort((a, b) => b.group_number - a.group_number);
    chosenGroupId = underFourGroups[0].id;
  } else {
    // All groups are at 4. Create a new group (starts a new remainder cycle).
    const maxGroupNumber = Math.max(...groupList.map((g) => g.group_number));
    const newGroupNumber = maxGroupNumber + 1;
    const newGroupName = `Group ${numberToLetter(newGroupNumber)}`;

    const { data: newGroup, error: newGroupError } = await supabase
      .from("format_prediction_groups")
      .insert({
        classification_id: classificationId,
        competition_id: groupList[0].competition_id,
        group_name: newGroupName,
        group_number: newGroupNumber,
        target_size: 4,
        metadata: {},
      })
      .select("id")
      .single();

    if (newGroupError) throw new Error(`Failed to create new group: ${newGroupError.message}`);
    chosenGroupId = newGroup.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("format_group_memberships")
    .insert({
      group_id: chosenGroupId,
      classification_id: classificationId,
      user_id: userId,
      seed_position: null,
      status: "active",
    })
    .select("*")
    .single();

  if (insertError) throw new Error(`Failed to add late entrant: ${insertError.message}`);
  return inserted as FormatGroupMembership;
}

// ============================================================
// Lock-time Reconciliation (mod-4 remainder resolution)
//
// Groups follow modular-4 arithmetic: standard size is 4.
// At lock time, the Remainder Group (newest group) may have
// < 3 members (an Undersized Group). Reconciliation absorbs
// those members into the nearest viable groups:
//   Remainder 1 → absorbed into highest-numbered group of 4 (→ Expanded Group of 5)
//   Remainder 2 → each absorbed into a separate group of 4 (→ 2 Expanded Groups of 5)
//   Remainder 3 → viable group, left alone
//   Remainder 0 → all groups of 4, nothing to do
// Max 1 group of 3, max 2 groups of 5 after reconciliation.
// ============================================================

export interface ReconciliationResult {
  dissolved: string[];
  modified: string[];
  movedMembers: number;
}

export async function reconcileUndersizedGroups(
  supabase: SupabaseClient,
  classificationId: string,
): Promise<ReconciliationResult | null> {
  // Load all active groups
  const { data: rawGroups, error: groupError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size, status")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupError) throw new Error(`Failed to fetch groups: ${groupError.message}`);

  // Filter active groups in app code — safe when status column doesn't exist yet
  const groups = (rawGroups ?? []).filter(
    (g) => !g.status || g.status === "active"
  );
  if (groups.length === 0) return null;

  // Load all active memberships
  const { data: memberships, error: mbError } = await supabase
    .from("format_group_memberships")
    .select("id, group_id, user_id")
    .eq("classification_id", classificationId)
    .eq("status", "active");

  if (mbError) throw new Error(`Failed to fetch memberships: ${mbError.message}`);

  // Build member counts per group
  const membersByGroup = new Map<string, string[]>();
  for (const g of groups) membersByGroup.set(g.id, []);
  for (const m of memberships ?? []) {
    const list = membersByGroup.get(m.group_id);
    if (list) list.push(m.user_id);
  }

  // Identify undersized (< 3) and viable (>= 3) groups
  const undersized = groups.filter((g) => (membersByGroup.get(g.id)?.length ?? 0) < 3);
  if (undersized.length === 0) return null;

  const viable = groups.filter((g) => (membersByGroup.get(g.id)?.length ?? 0) >= 3);
  if (viable.length === 0) {
    throw new Error("All groups are undersized — cannot reconcile");
  }

  // Collect orphans from undersized groups
  const orphans: string[] = [];
  for (const g of undersized) {
    orphans.push(...(membersByGroup.get(g.id) ?? []));
  }

  if (orphans.length === 0) return null;

  // Distribute orphans into viable groups (highest group_number first, max 5)
  // Track which viable groups receive members
  const viableSizes = new Map<string, number>();
  for (const g of viable) viableSizes.set(g.id, membersByGroup.get(g.id)?.length ?? 0);

  const viableSorted = [...viable].sort((a, b) => b.group_number - a.group_number);
  const moves: { userId: string; targetGroupId: string }[] = [];
  const modifiedGroupIds = new Set<string>();

  for (const userId of orphans) {
    const target = viableSorted.find((g) => (viableSizes.get(g.id) ?? 0) < 5);
    if (!target) {
      throw new Error("No viable group has room (< 5) to absorb orphan");
    }
    moves.push({ userId, targetGroupId: target.id });
    viableSizes.set(target.id, (viableSizes.get(target.id) ?? 0) + 1);
    modifiedGroupIds.add(target.id);
  }

  // Execute: move memberships
  for (const move of moves) {
    const { error } = await supabase
      .from("format_group_memberships")
      .update({ group_id: move.targetGroupId })
      .eq("classification_id", classificationId)
      .eq("user_id", move.userId);

    if (error) throw new Error(`Failed to move member ${move.userId}: ${error.message}`);
  }

  // Update target_size on modified groups
  for (const groupId of modifiedGroupIds) {
    const newSize = viableSizes.get(groupId) ?? 0;
    await supabase
      .from("format_prediction_groups")
      .update({ target_size: newSize })
      .eq("id", groupId);
  }

  // Delete dissolved groups
  const dissolvedIds = undersized.map((g) => g.id);
  await supabase
    .from("format_prediction_groups")
    .delete()
    .in("id", dissolvedIds);

  const dissolvedNames = undersized.map((g) => g.group_name);
  const modifiedNames = viable
    .filter((g) => modifiedGroupIds.has(g.id))
    .map((g) => g.group_name);

  console.log(
    `[reconcile] Dissolved ${dissolvedNames.join(", ")} → absorbed into ${modifiedNames.join(", ")} (${moves.length} members moved)`,
  );

  return {
    dissolved: dissolvedNames,
    modified: modifiedNames,
    movedMembers: moves.length,
  };
}

// ============================================================
// Group integrity health check — runs every cron cycle.
// Catches three classes of issue:
//   1. Ungrouped members (in classification but not in any group)
//   2. target_size mismatches (actual count != stored target_size)
//   3. Undersized groups (< 3 members, delegated to reconcile)
// ============================================================

export interface IntegrityResult {
  placed: number;
  targetSizeFixed: number;
  reconciliation: ReconciliationResult | null;
}

export async function ensureGroupIntegrity(
  supabase: SupabaseClient,
  classificationId: string,
): Promise<IntegrityResult> {
  const result: IntegrityResult = { placed: 0, targetSizeFixed: 0, reconciliation: null };

  // 1. Find ungrouped classification members and place them
  const { data: classMembers } = await supabase
    .from("classification_memberships")
    .select("user_id")
    .eq("classification_id", classificationId)
    .eq("status", "active");

  const { data: groupMembers } = await supabase
    .from("format_group_memberships")
    .select("user_id")
    .eq("classification_id", classificationId);

  const groupedSet = new Set((groupMembers ?? []).map((m) => m.user_id));
  const ungrouped = (classMembers ?? []).filter((m) => !groupedSet.has(m.user_id));

  for (const member of ungrouped) {
    try {
      await addLateEntrant(supabase, classificationId, member.user_id);
      result.placed++;
    } catch (err) {
      console.error(`[integrity] Failed to place ${member.user_id}: ${(err as Error).message}`);
    }
  }

  // 2. Fix target_size mismatches on all active groups
  const { data: integrityGroupsRaw } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, target_size, status")
    .eq("classification_id", classificationId);

  // Filter active groups in app code — safe when status column doesn't exist yet
  const groups = (integrityGroupsRaw ?? []).filter(
    (g) => !g.status || g.status === "active"
  );

  const { data: allMemberships } = await supabase
    .from("format_group_memberships")
    .select("group_id")
    .eq("classification_id", classificationId);

  const actualCounts = new Map<string, number>();
  for (const g of groups ?? []) actualCounts.set(g.id, 0);
  for (const m of allMemberships ?? []) {
    actualCounts.set(m.group_id, (actualCounts.get(m.group_id) ?? 0) + 1);
  }

  for (const g of groups ?? []) {
    const actual = actualCounts.get(g.id) ?? 0;
    if (actual !== g.target_size && actual > 0) {
      await supabase
        .from("format_prediction_groups")
        .update({ target_size: actual })
        .eq("id", g.id);
      result.targetSizeFixed++;
      console.log(`[integrity] ${g.group_name}: target_size ${g.target_size} → ${actual}`);
    }
  }

  // 3. Run undersized group reconciliation (delegates to existing function)
  result.reconciliation = await reconcileUndersizedGroups(supabase, classificationId);

  return result;
}

// ============================================================
// Can the draw be regenerated?
// True if first prediction window hasn't locked yet.
// ============================================================

export function canRegenerateDraw(firstWindowLockTime: Date): boolean {
  return new Date() < firstWindowLockTime;
}

// ============================================================
// Internal helpers
// ============================================================

/** Distribute shuffled users into groups according to composition. */
function distributeIntoGroups<T>(arr: T[], composition: GroupComposition): T[][] {
  const chunks: T[][] = [];
  let offset = 0;

  // Groups of 5 first (they get auto-qualifying third)
  for (let i = 0; i < composition.groups5; i++) {
    chunks.push(arr.slice(offset, offset + 5));
    offset += 5;
  }
  // Groups of 4
  for (let i = 0; i < composition.groups4; i++) {
    chunks.push(arr.slice(offset, offset + 4));
    offset += 4;
  }
  // Groups of 3
  for (let i = 0; i < composition.groups3; i++) {
    chunks.push(arr.slice(offset, offset + 3));
    offset += 3;
  }

  return chunks;
}

function cryptoShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = randomBytes[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cryptoChoice<T>(arr: T[]): T {
  if (arr.length === 1) return arr[0];
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  return arr[randomBytes[0] % arr.length];
}

function numberToLetter(n: number): string {
  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}
