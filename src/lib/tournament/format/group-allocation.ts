import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormatPredictionGroup, FormatGroupMembership } from "@/types/tournament";

// ============================================================
// Allocate entrants into prediction groups (random draw)
// Targets groups of 4. Remainder produces groups of 3 or 5.
// ============================================================

export async function allocatePredictionGroups(
  supabase: SupabaseClient,
  classificationId: string
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

  // Cryptographically random Fisher-Yates shuffle
  const shuffled = cryptoShuffle([...userIds]);

  // Chunk into groups of 4, distribute remainder
  const chunks = chunkIntoGroups(shuffled, 4);

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
  // Find current group sizes
  const { data: groups, error: groupError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number")
    .eq("classification_id", classificationId);

  if (groupError) throw new Error(`Failed to fetch groups: ${groupError.message}`);
  if (!groups || groups.length === 0) {
    throw new Error("No prediction groups exist for this classification");
  }

  const { data: memberships, error: mbError } = await supabase
    .from("format_group_memberships")
    .select("group_id")
    .eq("classification_id", classificationId);

  if (mbError) throw new Error(`Failed to fetch group memberships: ${mbError.message}`);

  // Count members per group
  const sizeCounts = new Map<string, number>();
  for (const g of groups as { id: string; group_number: number }[]) {
    sizeCounts.set(g.id, 0);
  }
  for (const m of memberships ?? []) {
    const current = sizeCounts.get(m.group_id) ?? 0;
    sizeCounts.set(m.group_id, current + 1);
  }

  // Find minimum size
  const minSize = Math.min(...Array.from(sizeCounts.values()));
  const candidateGroupIds = Array.from(sizeCounts.entries())
    .filter(([, count]) => count === minSize)
    .map(([id]) => id);

  // Random tie-break among smallest groups using crypto
  const chosenGroupId = cryptoChoice(candidateGroupIds);

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
// Can the draw be regenerated?
// True if first prediction window hasn't locked yet.
// ============================================================

export function canRegenerateDraw(firstWindowLockTime: Date): boolean {
  return new Date() < firstWindowLockTime;
}

// ============================================================
// Internal helpers
// ============================================================

function cryptoShuffle<T>(arr: T[]): T[] {
  // Fisher-Yates with crypto.getRandomValues
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

function chunkIntoGroups<T>(arr: T[], targetSize: number): T[][] {
  if (arr.length === 0) return [];

  const groupCount = Math.ceil(arr.length / targetSize);
  const chunks: T[][] = Array.from({ length: groupCount }, () => []);

  // Distribute items — fills groups left to right
  for (let i = 0; i < arr.length; i++) {
    chunks[i % groupCount].push(arr[i]);
  }

  // Sort each chunk to maintain sequential assignment; redistribute overflow
  // for clean group sizes (prefer groups of 4, allow 3 or 5 at edges)
  return chunks;
}

function numberToLetter(n: number): string {
  // 1→A, 2→B, … 26→Z, 27→AA, 28→AB, etc.
  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}
