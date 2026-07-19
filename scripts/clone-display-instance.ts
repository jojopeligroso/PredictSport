/**
 * Clone script: Create anonymised competition instance #2 for the display site.
 *
 * Creates a new competition instance in the SAME database by cloning
 * instance #1's per-instance data with UUID remapping and anonymisation.
 * Structural data (events, rounds, stages) is shared via tournament_id.
 *
 * Usage:
 *   npx tsx scripts/clone-display-instance.ts          # dry run
 *   npx tsx scripts/clone-display-instance.ts --commit # writes to DB
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional overrides:
 *   WC_ARCHIVE_COMPETITION_ID  (source instance, default: 1a4448e5-...)
 *   WC_ARCHIVE_DEMO_USER_ID    (source viewer, default: 8c7e2e1b-...)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local may not exist
  }
}

loadEnv(resolve(__dirname, "../.env.local"));

const COMMIT = process.argv.includes("--commit");

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const SOURCE_COMPETITION_ID =
  process.env.WC_ARCHIVE_COMPETITION_ID ||
  "1a4448e5-a178-45ab-b819-a0dfab370306";

const SOURCE_DEMO_USER_ID =
  process.env.WC_ARCHIVE_DEMO_USER_ID ||
  "8c7e2e1b-0564-4d86-93e2-85ecf00f1e00";

const TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

function deterministicUuid(namespace: string, input: string): string {
  const combined = `${namespace}:${input}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0xdeadbeef;
  let h4 = 0xcafebabe;

  for (let i = 0; i < combined.length; i++) {
    const c = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x100001b3);
    h3 = Math.imul(h3 ^ c, 0x01000193);
    h4 = Math.imul(h4 ^ c, 0x100001b3);
  }

  const hex = [
    (h1 >>> 0).toString(16).padStart(8, "0"),
    (h2 >>> 0).toString(16).padStart(8, "0"),
    (h3 >>> 0).toString(16).padStart(8, "0"),
    (h4 >>> 0).toString(16).padStart(8, "0"),
  ].join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

const NS = "predictsport-display-clone-2026";

class UuidMapper {
  private map = new Map<string, string>();
  private demoSyntheticId: string;

  constructor(demoSourceId: string) {
    this.demoSyntheticId = deterministicUuid(NS, "demo-viewer");
    this.map.set(demoSourceId, this.demoSyntheticId);
  }

  /** Get or create a deterministic synthetic UUID for a real UUID. */
  get(realUuid: string): string {
    let synthetic = this.map.get(realUuid);
    if (!synthetic) {
      synthetic = deterministicUuid(NS, realUuid);
      this.map.set(realUuid, synthetic);
    }
    return synthetic;
  }

  getDemoSyntheticId(): string {
    return this.demoSyntheticId;
  }

  size(): number {
    return this.map.size;
  }

  allEntries(): [string, string][] {
    return Array.from(this.map.entries());
  }
}

/**
 * Generate a new deterministic UUID for a row ID (classification, group, etc.)
 * These are NOT user UUIDs — they're structural IDs that need to be unique
 * in the same tables.
 */
function newRowId(table: string, sourceId: string): string {
  return deterministicUuid(`${NS}:row:${table}`, sourceId);
}

// ---------------------------------------------------------------------------
// Pseudonyms (mirrors src/lib/tournament/visibility.ts)
// ---------------------------------------------------------------------------

const MYSTERY_ANIMALS = [
  "Otter", "Hawk", "Lynx", "Badger", "Fox", "Stoat", "Heron", "Pine Marten",
  "Hare", "Owl", "Falcon", "Stag", "Salmon", "Wren", "Curlew", "Kestrel",
  "Jay", "Magpie", "Raven", "Finch", "Swift", "Robin", "Linnet", "Goldcrest",
  "Pike", "Trout", "Mackerel", "Seal", "Dolphin", "Whale", "Puffin", "Gannet",
  "Razorbill", "Tern", "Plover", "Lapwing", "Snipe", "Woodcock", "Pheasant",
  "Partridge", "Grouse", "Buzzard", "Harrier", "Eagle", "Osprey", "Merlin",
  "Goshawk", "Sparrowhawk", "Peregrine", "Bittern", "Egret", "Cormorant",
  "Kingfisher", "Dipper", "Treecreeper", "Nuthatch", "Bullfinch", "Greenfinch",
  "Siskin", "Crossbill",
] as const;

const DISPLAY_SURNAMES = [
  "López", "García", "Hernández", "Ramírez", "Torres",
  "Flores", "Cruz", "Morales", "Reyes", "Mendoza",
  "Lynch", "Murphy", "O'Brien", "Kelly", "Doyle",
  "Walsh", "Byrne", "Ryan", "O'Sullivan", "Brennan",
  "Dupont",
  "Kowalski", "Nowak",
  "Smith", "Clarke", "Thompson", "Edwards", "Hughes",
  "Bennett", "Ward", "Palmer", "Hart", "Fletcher",
] as const;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function generatePseudonym(syntheticUserId: string, usedNames: Set<string>): string {
  const seed = hashSeed(syntheticUserId);
  const animal = MYSTERY_ANIMALS[seed % MYSTERY_ANIMALS.length];
  const surname = DISPLAY_SURNAMES[hashSeed(`${syntheticUserId}:surname`) % DISPLAY_SURNAMES.length];
  const candidate = `${animal} ${surname}`;
  if (!usedNames.has(candidate)) return candidate;
  for (let i = 1; i < MYSTERY_ANIMALS.length; i++) {
    const alt = `${MYSTERY_ANIMALS[(seed + i) % MYSTERY_ANIMALS.length]} ${surname}`;
    if (!usedNames.has(alt)) return alt;
  }
  let suffix = 2;
  while (usedNames.has(`${candidate} ${suffix}`)) suffix++;
  return `${candidate} ${suffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  buildQuery?: (base: any) => any,
): Promise<Record<string, any>[]> {
  const PAGE_SIZE = 1000;
  const all: Record<string, any>[] = [];
  let offset = 0;

  while (true) {
    const base = supabase.from(table).select("*").range(offset, offset + PAGE_SIZE - 1);
    const query = buildQuery ? buildQuery(base) : base;
    const { data, error } = await query;
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

async function batchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`Insert ${table} (rows ${i}–${i + chunk.length}): ${error.message}`);
    }
  }
}

function log(msg: string) {
  console.log(`[clone] ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(COMMIT ? "COMMIT MODE — will write to DB" : "DRY RUN — no writes");
  log(`Database: ${SUPABASE_URL}`);
  log(`Source competition: ${SOURCE_COMPETITION_ID}`);
  log(`Source demo user: ${SOURCE_DEMO_USER_ID}`);
  log(`Tournament: ${TOURNAMENT_ID}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const userMap = new UuidMapper(SOURCE_DEMO_USER_ID);
  const pseudonymMap = new Map<string, string>();
  const usedNames = new Set<string>();

  // New competition ID for instance #2
  const INSTANCE2_ID = newRowId("competitions", SOURCE_COMPETITION_ID);
  log(`Instance #2 ID: ${INSTANCE2_ID}`);

  // =========================================================================
  // Phase 1: Fetch source instance data
  // =========================================================================
  log("\n=== Phase 1: Fetching source data ===");

  // Competition
  const { data: srcComp, error: compErr } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", SOURCE_COMPETITION_ID)
    .single();
  if (compErr || !srcComp) throw new Error(`Competition not found: ${compErr?.message}`);
  log(`Competition: "${srcComp.name}" (instance ${srcComp.instance_number})`);

  // Check instance #2 doesn't already exist — if it does, clean it up
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", INSTANCE2_ID)
    .maybeSingle();
  if (existing) {
    log(`\nInstance #2 already exists (${INSTANCE2_ID}). Cleaning up...`);
    if (COMMIT) {
      // Delete in reverse dependency order
      for (const table of [
        "stage_results", "member_tags", "classification_standings_snapshots",
        "bracket_prediction_submissions", "format_group_memberships",
        "classification_memberships", "predictions", "competition_members",
        "result_finalisations", "format_prediction_groups", "classifications",
      ]) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("competition_id", INSTANCE2_ID);
        if (error) log(`  WARNING: cleaning ${table}: ${error.message}`);
        else log(`  Cleaned ${table}`);
      }
      // Delete competition row itself
      await supabase.from("competitions").delete().eq("id", INSTANCE2_ID);
      log("  Cleaned competition row");
      // Delete synthetic auth.users (cascades to public.users)
      const { data: synthUsers } = await supabase
        .from("users")
        .select("id, email")
        .like("email", "%@display.predictsport.local");
      if (synthUsers && synthUsers.length > 0) {
        for (const su of synthUsers) {
          await supabase.auth.admin.deleteUser(su.id);
        }
        log(`  Deleted ${synthUsers.length} synthetic auth+public users`);
      }
      log("  Cleanup complete\n");
    } else {
      log("  (dry run — would clean up before re-cloning)");
    }
  }

  // Competition members
  const members = await fetchAll(supabase, "competition_members", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Members: ${members.length}`);

  // Classifications
  const classifications = await fetchAll(supabase, "classifications", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Classifications: ${classifications.length}`);

  const srcClassIds = classifications.map((c) => c.id as string);

  // Classification memberships
  let classMembers: Record<string, any>[] = [];
  if (srcClassIds.length > 0) {
    classMembers = await fetchAll(supabase, "classification_memberships", (q) =>
      q.in("classification_id", srcClassIds),
    );
  }
  log(`Classification memberships: ${classMembers.length}`);

  // Format prediction groups
  let formatGroups: Record<string, any>[] = [];
  if (srcClassIds.length > 0) {
    formatGroups = await fetchAll(supabase, "format_prediction_groups", (q) =>
      q.in("classification_id", srcClassIds),
    );
  }
  log(`Format prediction groups: ${formatGroups.length}`);

  const srcGroupIds = formatGroups.map((g) => g.id as string);

  // Format group memberships
  let groupMembers: Record<string, any>[] = [];
  if (srcGroupIds.length > 0) {
    groupMembers = await fetchAll(supabase, "format_group_memberships", (q) =>
      q.in("group_id", srcGroupIds),
    );
  }
  log(`Format group memberships: ${groupMembers.length}`);

  const memberUserIds = members.map((m) => m.user_id as string);

  // Predictions — fetch via events, filtered to instance #1 members only
  const events = await fetchAll(supabase, "events", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  const eventIds = events.map((e) => e.id as string);
  const memberUserIdSet = new Set(memberUserIds);
  let predictions: Record<string, any>[] = [];
  for (let i = 0; i < eventIds.length; i += 100) {
    const chunk = eventIds.slice(i, i + 100);
    const rows = await fetchAll(supabase, "predictions", (q) =>
      q.in("event_id", chunk),
    );
    // Filter to only instance #1's members (other instances share these events)
    predictions.push(...rows.filter((p) => memberUserIdSet.has(p.user_id)));
  }
  log(`Predictions: ${predictions.length} (filtered to ${memberUserIdSet.size} members)`);

  // Bracket prediction submissions
  const brackets = await fetchAll(supabase, "bracket_prediction_submissions", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Bracket submissions: ${brackets.length}`);

  // Classification standings snapshots
  const snapshots = await fetchAll(supabase, "classification_standings_snapshots", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Standings snapshots: ${snapshots.length}`);

  // Member tags
  const tags = await fetchAll(supabase, "member_tags", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Member tags: ${tags.length}`);

  // Stage results
  const stageResults = await fetchAll(supabase, "stage_results", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Stage results: ${stageResults.length}`);

  // Result finalisations
  const finalisations = await fetchAll(supabase, "result_finalisations", (q) =>
    q.eq("competition_id", SOURCE_COMPETITION_ID),
  );
  log(`Result finalisations: ${finalisations.length}`);

  // =========================================================================
  // Phase 2: Build mappings
  // =========================================================================
  log("\n=== Phase 2: Building UUID + structural ID maps ===");

  // Only create synthetic users for actual competition members.
  // Non-member references (created_by, finalised_by, etc.) get remapped to the
  // demo viewer — they're administrative fields, never displayed to users.
  const allUserIds = new Set(memberUserIds);

  // Register members in UUID mapper
  for (const uid of Array.from(allUserIds)) userMap.get(uid);

  log(`User mappings: ${userMap.size()} (${allUserIds.size} unique source users)`);
  log(`Demo viewer: ${SOURCE_DEMO_USER_ID} → ${userMap.getDemoSyntheticId()}`);

  // Fetch source user rows for ALL referenced users (for created_at)
  const allUserIdArray = Array.from(allUserIds);
  let sourceUsers: Record<string, any>[] = [];
  for (let i = 0; i < allUserIdArray.length; i += 100) {
    const chunk = allUserIdArray.slice(i, i + 100);
    const rows = await fetchAll(supabase, "users", (q) => q.in("id", chunk));
    sourceUsers.push(...rows);
  }
  const sourceUserMap = new Map(sourceUsers.map((u) => [u.id as string, u]));
  log(`Source users fetched: ${sourceUsers.length}`);

  // Build pseudonyms
  for (const [, syntheticId] of userMap.allEntries()) {
    const name = generatePseudonym(syntheticId, usedNames);
    usedNames.add(name);
    pseudonymMap.set(syntheticId, name);
  }

  // Build classification ID map: srcClassId → newClassId
  const classIdMap = new Map<string, string>();
  for (const c of classifications) {
    classIdMap.set(c.id, newRowId("classifications", c.id));
  }

  // Build group ID map: srcGroupId → newGroupId
  const groupIdMap = new Map<string, string>();
  for (const g of formatGroups) {
    groupIdMap.set(g.id, newRowId("format_prediction_groups", g.id));
  }

  // Build finalisation ID map
  const finIdMap = new Map<string, string>();
  for (const f of finalisations) {
    finIdMap.set(f.id, newRowId("result_finalisations", f.id));
  }

  // =========================================================================
  // Phase 3: Transform
  // =========================================================================
  log("\n=== Phase 3: Transforming data ===");

  const remap = (row: Record<string, any>, field: string) => {
    if (row[field] && typeof row[field] === "string") {
      // Non-member references (admin fields) get mapped to the demo viewer
      if (memberUserIdSet.has(row[field])) {
        row[field] = userMap.get(row[field]);
      } else {
        row[field] = userMap.getDemoSyntheticId();
      }
    }
  };

  // 3a. Competition — new instance
  const newComp = { ...srcComp };
  newComp.id = INSTANCE2_ID;
  newComp.instance_number = 2;
  newComp.invite_code = "DISPLAY";
  newComp.product_mode = "world_cup_2026_archive";
  newComp.tournament_id = TOURNAMENT_ID; // Explicit per spec §13.3
  remap(newComp, "created_by");

  // 3b. Synthetic users — preserve created_at from source
  const syntheticUsers = userMap.allEntries().map(([realId, syntheticId]) => {
    const srcUser = sourceUserMap.get(realId);
    return {
      id: syntheticId,
      email: `${syntheticId.slice(0, 8)}@display.predictsport.local`,
      display_name: pseudonymMap.get(syntheticId) ?? "Anonymous",
      avatar_url: null,
      is_super_admin: false,
      notification_prefs: null,
      timezone: null,
      telegram_id: null,
      telegram_username: null,
      favourite_team: null,
      display_name_updated_at: null,
      created_at: srcUser?.created_at ?? new Date().toISOString(),
    };
  });
  log(`Synthetic users: ${syntheticUsers.length}`);

  // 3c. Competition members — nullify callout_label (potential PII)
  const newMembers = members.map((m) => {
    const row = { ...m };
    row.id = newRowId("competition_members", m.id);
    row.competition_id = INSTANCE2_ID;
    row.callout_label = null;
    remap(row, "user_id");
    return row;
  });

  // 3d. Predictions — same event_id (shared), remapped user_id
  const newPredictions = predictions.map((p) => {
    const row = { ...p };
    row.id = newRowId("predictions", p.id);
    const isViewer = p.user_id === SOURCE_DEMO_USER_ID;
    remap(row, "user_id");
    if (!isViewer) {
      row.note_text = null;
      row.note_visibility = "private";
    }
    return row;
  });

  // 3e. Classifications
  const newClassifications = classifications.map((c) => {
    const row = { ...c };
    row.id = classIdMap.get(c.id)!;
    row.competition_id = INSTANCE2_ID;
    return row;
  });

  // 3f. Classification memberships
  const newClassMembers = classMembers.map((cm) => {
    const row = { ...cm };
    row.id = newRowId("classification_memberships", cm.id);
    row.classification_id = classIdMap.get(cm.classification_id) ?? cm.classification_id;
    row.competition_id = INSTANCE2_ID;
    const syntheticId = userMap.get(cm.user_id);
    row.user_id = syntheticId;
    row.pseudonym = pseudonymMap.get(syntheticId) ?? null;
    row.display_visibility = "public";
    return row;
  });

  // 3g. Format prediction groups — nullify phase_id (classification_phases not cloned)
  const newFormatGroups = formatGroups.map((g) => {
    const row = { ...g };
    row.id = groupIdMap.get(g.id)!;
    row.classification_id = classIdMap.get(g.classification_id) ?? g.classification_id;
    row.competition_id = INSTANCE2_ID;
    row.phase_id = null;
    return row;
  });

  // 3h. Format group memberships
  const newGroupMembers = groupMembers.map((gm) => {
    const row = { ...gm };
    row.id = newRowId("format_group_memberships", gm.id);
    row.group_id = groupIdMap.get(gm.group_id) ?? gm.group_id;
    row.classification_id = classIdMap.get(gm.classification_id) ?? gm.classification_id;
    remap(row, "user_id");
    return row;
  });

  // 3i. Bracket submissions
  const newBrackets = brackets.map((b) => {
    const row = { ...b };
    row.id = newRowId("bracket_prediction_submissions", b.id);
    row.competition_id = INSTANCE2_ID;
    row.classification_id = classIdMap.get(b.classification_id) ?? b.classification_id;
    remap(row, "user_id");
    // bracket_data contains team/fixture picks, not user IDs
    return row;
  });

  // 3j. Standings snapshots — deep remap standings_data JSON
  const newSnapshots = snapshots.map((ss) => {
    const row = { ...ss };
    row.id = newRowId("classification_standings_snapshots", ss.id);
    row.competition_id = INSTANCE2_ID;
    row.classification_id = classIdMap.get(ss.classification_id) ?? ss.classification_id;
    if (ss.finalisation_id) {
      // Null out if finalisation doesn't belong to this instance (orphan FK)
      row.finalisation_id = finIdMap.get(ss.finalisation_id) ?? null;
    }
    remap(row, "generated_by");

    if (row.standings_data && Array.isArray(row.standings_data)) {
      row.standings_data = row.standings_data
        .filter((entry: Record<string, any>) =>
          !entry.user_id || memberUserIdSet.has(entry.user_id),
        )
        .map((entry: Record<string, any>) => {
          const remapped = { ...entry };
          if (remapped.user_id && typeof remapped.user_id === "string") {
            const syntheticId = userMap.get(remapped.user_id);
            remapped.user_id = syntheticId;
            remapped.display_name = pseudonymMap.get(syntheticId) ?? "Anonymous";
          }
          return remapped;
        });
    }

    return row;
  });

  // 3k. Member tags — exclude tags for non-members
  const newTags = tags
    .filter((t) => memberUserIdSet.has(t.user_id))
    .map((t) => {
      const row = { ...t };
      row.id = newRowId("member_tags", t.id);
      row.competition_id = INSTANCE2_ID;
      remap(row, "user_id");
      remap(row, "suppressed_by");
      return row;
    });

  // 3l. Stage results — exclude non-members
  const newStageResults = stageResults
    .filter((sr) => memberUserIdSet.has(sr.user_id))
    .map((sr) => {
      const row = { ...sr };
      row.id = newRowId("stage_results", sr.id);
      row.competition_id = INSTANCE2_ID;
      row.classification_id = classIdMap.get(sr.classification_id) ?? sr.classification_id;
      if (sr.group_id) {
        row.group_id = groupIdMap.get(sr.group_id) ?? sr.group_id;
      }
      remap(row, "user_id");
      return row;
    });

  // 3m. Result finalisations
  const newFinalisations = finalisations.map((f) => {
    const row = { ...f };
    row.id = finIdMap.get(f.id)!;
    row.competition_id = INSTANCE2_ID;
    remap(row, "finalised_by");
    return row;
  });

  // =========================================================================
  // Phase 4: Summary
  // =========================================================================
  log("\n=== Clone Summary ===");
  const tables = [
    { name: "competitions", rows: 1 },
    { name: "auth.users (via admin API)", rows: syntheticUsers.length },
    { name: "users", rows: syntheticUsers.length },
    { name: "competition_members", rows: newMembers.length },
    { name: "classifications", rows: newClassifications.length },
    { name: "classification_memberships", rows: newClassMembers.length },
    { name: "format_prediction_groups", rows: newFormatGroups.length },
    { name: "format_group_memberships", rows: newGroupMembers.length },
    { name: "predictions", rows: newPredictions.length },
    { name: "bracket_prediction_submissions", rows: newBrackets.length },
    { name: "classification_standings_snapshots", rows: newSnapshots.length },
    { name: "member_tags", rows: newTags.length },
    { name: "stage_results", rows: newStageResults.length },
    { name: "result_finalisations", rows: newFinalisations.length },
  ];

  for (const t of tables) {
    log(`  ${t.name}: ${t.rows} rows`);
  }

  log(`\nInstance #2 competition ID: ${INSTANCE2_ID}`);
  log(`Demo viewer synthetic UUID: ${userMap.getDemoSyntheticId()}`);
  log(`Demo viewer pseudonym: ${pseudonymMap.get(userMap.getDemoSyntheticId())}`);

  if (!COMMIT) {
    log("\n--- DRY RUN complete. Run with --commit to write. ---");
    return;
  }

  // =========================================================================
  // Phase 5: Write to DB
  // =========================================================================
  log("\n=== Phase 5: Writing to DB ===");

  // 5a. Create auth.users entries.
  //     The handle_new_user trigger fires on each INSERT into auth.users and:
  //       (1) creates a public.users row (display_name = '')
  //       (2) creates a personal competition + competition_member
  //     We let the trigger run, then fix up the users and clean up the junk.
  log("Creating auth.users entries (trigger will create public.users + personal comps)...");
  let authCreated = 0;
  const createdSyntheticIds: string[] = [];
  for (const u of syntheticUsers) {
    const { error } = await supabase.auth.admin.createUser({
      id: u.id,
      email: u.email,
      email_confirm: true,
      user_metadata: { display_name: u.display_name },
    } as any);
    if (error) {
      if (error.message?.includes("already been registered")) {
        log(`  Skipping existing auth user ${u.id.slice(0, 8)}...`);
      } else {
        log(`  WARNING: auth.users ${u.id.slice(0, 8)}: ${error.message}`);
      }
    } else {
      authCreated++;
      createdSyntheticIds.push(u.id);
    }
  }
  log(`  Created ${authCreated} auth.users entries`);

  // 5b. Update trigger-created public.users rows with correct display_name, avatar, etc.
  log("Updating public.users rows with pseudonyms...");
  for (const u of syntheticUsers) {
    const { error } = await supabase
      .from("users")
      .update({
        display_name: u.display_name,
        avatar_url: null,
        is_super_admin: false,
        notification_prefs: null,
        timezone: null,
        telegram_id: null,
        telegram_username: null,
        favourite_team: null,
        display_name_updated_at: null,
      })
      .eq("id", u.id);
    if (error) {
      log(`  WARNING: update user ${u.id.slice(0, 8)}: ${error.message}`);
    }
  }

  // 5c. Delete unwanted personal competitions + members created by trigger.
  if (createdSyntheticIds.length > 0) {
    log("Cleaning up trigger-created personal competitions...");
    // Personal competitions have type='personal' and created_by = synthetic user
    for (let i = 0; i < createdSyntheticIds.length; i += 100) {
      const chunk = createdSyntheticIds.slice(i, i + 100);
      // Delete competition_members first (FK)
      const { data: personalComps } = await supabase
        .from("competitions")
        .select("id")
        .eq("type", "personal")
        .in("created_by", chunk);
      if (personalComps && personalComps.length > 0) {
        const pcIds = personalComps.map((c: any) => c.id);
        await supabase
          .from("competition_members")
          .delete()
          .in("competition_id", pcIds);
        await supabase
          .from("competitions")
          .delete()
          .in("id", pcIds);
        log(`  Deleted ${personalComps.length} personal competitions`);
      }
    }
  }

  // 5d. Resumable inserts — check each table before inserting.
  //     Safe to re-run after a partial failure without deleting anything.
  async function insertIfEmpty(
    table: string,
    rows: Record<string, any>[],
    checkQuery: () => Promise<{ count: number | null }>,
  ) {
    const { count } = await checkQuery();
    if (count && count > 0) {
      log(`  ${table}: ${count} rows already exist — skipping`);
      return;
    }
    log(`  ${table}: inserting ${rows.length} rows...`);
    await batchInsert(supabase, table, rows);
  }

  async function countByCompetition(table: string): Promise<{ count: number | null }> {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("competition_id", INSTANCE2_ID);
    return { count };
  }

  // Competition
  const { data: compExists } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", INSTANCE2_ID)
    .maybeSingle();
  if (compExists) {
    log("  competitions: already exists — skipping");
  } else {
    log("  competitions: inserting...");
    await batchInsert(supabase, "competitions", [newComp]);
  }

  log("\nInserting per-instance data (resumable)...");

  await insertIfEmpty("classifications", newClassifications, () => countByCompetition("classifications"));
  await insertIfEmpty("format_prediction_groups", newFormatGroups, () => countByCompetition("format_prediction_groups"));
  await insertIfEmpty("result_finalisations", newFinalisations, () => countByCompetition("result_finalisations"));
  await insertIfEmpty("competition_members", newMembers, () => countByCompetition("competition_members"));

  // predictions doesn't have competition_id — check via user_id membership
  await insertIfEmpty("predictions", newPredictions, async () => {
    const demoSyntheticId = userMap.getDemoSyntheticId();
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", demoSyntheticId);
    return { count };
  });

  await insertIfEmpty("classification_memberships", newClassMembers, () => countByCompetition("classification_memberships"));

  // format_group_memberships doesn't have competition_id — check via group_id
  await insertIfEmpty("format_group_memberships", newGroupMembers, async () => {
    const newGroupIdsList = Array.from(groupIdMap.values());
    if (newGroupIdsList.length === 0) return { count: 0 };
    const { count } = await supabase
      .from("format_group_memberships")
      .select("*", { count: "exact", head: true })
      .in("group_id", newGroupIdsList.slice(0, 10));
    return { count };
  });

  await insertIfEmpty("bracket_prediction_submissions", newBrackets, () => countByCompetition("bracket_prediction_submissions"));
  await insertIfEmpty("classification_standings_snapshots", newSnapshots, () => countByCompetition("classification_standings_snapshots"));
  await insertIfEmpty("member_tags", newTags, () => countByCompetition("member_tags"));
  await insertIfEmpty("stage_results", newStageResults, () => countByCompetition("stage_results"));

  // =========================================================================
  // Done
  // =========================================================================
  log("\n=== Clone complete ===");
  log(`\nSet these env vars on predictsport-display Vercel project:`);
  log(`  WC_ARCHIVE_COMPETITION_ID=${INSTANCE2_ID}`);
  log(`  WC_ARCHIVE_DEMO_USER_ID=${userMap.getDemoSyntheticId()}`);
}

main().catch((err) => {
  console.error("[clone] FATAL:", err);
  process.exit(1);
});
