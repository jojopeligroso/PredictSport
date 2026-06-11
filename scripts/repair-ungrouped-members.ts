/**
 * One-time repair script: find competition members who are in
 * classification_memberships but NOT in format_group_memberships,
 * and slot them into groups via addLateEntrant.
 *
 * Usage: npx tsx scripts/repair-ungrouped-members.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { addLateEntrant } from "../src/lib/tournament/format/group-allocation";

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(resolve(filePath), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* no .env.local */
  }
}

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // Find the format_elimination classification
  const { data: formatCls, error: clsError } = await supabase
    .from("classifications")
    .select("id, competition_id")
    .eq("classification_type", "format_elimination")
    .eq("status", "active")
    .single();

  if (clsError || !formatCls) {
    console.error("No active format_elimination classification found:", clsError?.message);
    process.exit(1);
  }

  console.log(`Classification: ${formatCls.id} (competition: ${formatCls.competition_id})`);

  // Find all active classification members
  const { data: classMembers } = await supabase
    .from("classification_memberships")
    .select("user_id")
    .eq("classification_id", formatCls.id)
    .eq("status", "active");

  // Find all group members
  const { data: groupMembers } = await supabase
    .from("format_group_memberships")
    .select("user_id")
    .eq("classification_id", formatCls.id);

  const groupedUserIds = new Set((groupMembers ?? []).map((m) => m.user_id));
  const ungrouped = (classMembers ?? []).filter((m) => !groupedUserIds.has(m.user_id));

  console.log(`Total classification members: ${classMembers?.length ?? 0}`);
  console.log(`Total grouped members: ${groupMembers?.length ?? 0}`);
  console.log(`Ungrouped members: ${ungrouped.length}`);

  if (ungrouped.length === 0) {
    console.log("No ungrouped members found. Nothing to repair.");
    process.exit(0);
  }

  // Fetch display names for ungrouped users
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, email")
    .in("id", ungrouped.map((m) => m.user_id));

  console.log("\nUngrouped users:");
  for (const u of users ?? []) {
    console.log(`  - ${u.display_name ?? "No name"} (${u.email ?? u.id})`);
  }

  // Add each ungrouped user via addLateEntrant
  console.log("\nAdding ungrouped users to groups...\n");

  for (const member of ungrouped) {
    try {
      const result = await addLateEntrant(supabase, formatCls.id, member.user_id);
      const user = (users ?? []).find((u) => u.id === member.user_id);
      console.log(
        `  Added ${user?.display_name ?? member.user_id} → group ${result.group_id}`
      );
    } catch (err) {
      console.error(`  FAILED for ${member.user_id}: ${(err as Error).message}`);
    }
  }

  // Show final group state
  const { data: groups } = await supabase
    .from("format_prediction_groups")
    .select("group_name, group_number")
    .eq("classification_id", formatCls.id)
    .order("group_number", { ascending: true });

  console.log(`\nFinal groups: ${(groups ?? []).map((g) => g.group_name).join(", ")}`);

  const { data: finalGroupMembers } = await supabase
    .from("format_group_memberships")
    .select("group_id")
    .eq("classification_id", formatCls.id);

  console.log(`Total members in groups: ${finalGroupMembers?.length ?? 0}`);
}

main().catch(console.error);
