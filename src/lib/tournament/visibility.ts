import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-classification display visibility (ADR 0011).
 *
 * One chokepoint that everything reading standings goes through. Format is
 * always public — the survival ladder needs real names. Self always sees
 * their own real name. Everyone else sees the user's stable Mystery {Animal}
 * pseudonym when `display_visibility = 'private'`.
 */

// Curated list. Stable: don't reorder. Append only. Pseudonyms are persisted,
// so re-ordering wouldn't actually rename anyone — but it would change which
// new users get which animal, which makes test fixtures churn for no reason.
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

/**
 * Surnames for display-site pseudonyms. Mix of Mexican, Irish, French,
 * Polish, and British — paired with MYSTERY_ANIMALS to create full names.
 * Stable: don't reorder. The index is derived from the user_id hash.
 */
const DISPLAY_SURNAMES = [
  // Mexican
  "López", "García", "Hernández", "Ramírez", "Torres",
  "Flores", "Cruz", "Morales", "Reyes", "Mendoza",
  // Irish
  "Lynch", "Murphy", "O'Brien", "Kelly", "Doyle",
  "Walsh", "Byrne", "Ryan", "O'Sullivan", "Brennan",
  // French
  "Dupont",
  // Polish
  "Kowalski", "Nowak",
  // British
  "Smith", "Clarke", "Thompson", "Edwards", "Hughes",
  "Bennett", "Ward", "Palmer", "Hart", "Fletcher",
] as const;

export interface VisibleStandingRow {
  user_id: string;
  display_name: string;
  [k: string]: unknown;
}

interface MembershipVisibility {
  user_id: string;
  display_visibility: "public" | "private";
  pseudonym: string | null;
}

/**
 * Apply visibility rules to a list of standing rows.
 *
 * - Format (`classification_type === 'format_elimination'`) returns rows
 *   untouched.
 * - The viewer always sees their own real name (caller renders the YOU chip).
 * - Other rows whose membership is `private` get their `display_name`
 *   swapped for the persisted pseudonym. If a pseudonym is somehow missing
 *   (race: toggle without ensurePseudonym), we fall back to "Anonymous"
 *   rather than leak the name.
 */
export type ViewerRole = "admin" | "member" | "public";

export function applyVisibility<T extends VisibleStandingRow>(
  rows: T[],
  memberships: MembershipVisibility[],
  classificationType: string,
  viewerUserId: string,
  viewerRole: ViewerRole = "member",
): T[] {
  // Format elimination normally shows real names (the survival ladder needs
  // them). On the archive/display site, anonymise everything.
  const isArchive =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_archive";
  if (classificationType === "format_elimination" && !isArchive) return rows;

  const byUser = new Map(memberships.map((m) => [m.user_id, m]));

  // Track used pseudonyms to avoid collisions in the public view.
  // Pre-seed with stored pseudonyms so generated ones don't clash —
  // except in archive mode where we generate fresh "Animal Surname" names.
  const usedNames = new Set<string>(
    viewerRole === "public" && !isArchive
      ? memberships.filter((m) => m.pseudonym).map((m) => m.pseudonym!)
      : [],
  );

  return rows.map((row) => {
    if (viewerRole === "admin") {
      // Admins see all real names. For private users, append the pseudonym
      // so the admin knows what others see.
      const m = byUser.get(row.user_id);
      if (m?.display_visibility === "private") {
        const pseudonym = m.pseudonym ?? "Anonymous";
        return { ...row, display_name: `${row.display_name} (${pseudonym})` };
      }
      return row;
    }

    if (viewerRole === "public") {
      // Public viewers see everyone anonymized — no self-check.
      // On the display site, always generate fresh "Animal Surname"
      // pseudonyms (ignore stored animal-only pseudonyms).
      // On the normal site, prefer stored pseudonyms for consistency.
      const m = byUser.get(row.user_id);
      const pseudonym = isArchive
        ? generatePseudonym(row.user_id, usedNames)
        : (m?.pseudonym ?? generatePseudonym(row.user_id, usedNames));
      usedNames.add(pseudonym);
      return { ...row, display_name: pseudonym };
    }

    // Default 'member' behavior: self sees real name, private users anonymized.
    if (row.user_id === viewerUserId) return row;
    const m = byUser.get(row.user_id);
    if (!m || m.display_visibility !== "private") return row;
    return {
      ...row,
      display_name: m.pseudonym ?? "Anonymous",
    };
  });
}

/**
 * Generate or fetch the stable pseudonym for a user in a classification.
 *
 * Persists on first call so toggling private→public→private returns the same
 * handle. Uses a deterministic preferred index from a hash of
 * (user_id, classification_id) and then walks forward through the list until
 * an unused slot is found in that classification (collision unlikely for
 * <60 entrants, but worth guarding the unique index).
 */
export async function ensurePseudonym(
  supabase: SupabaseClient,
  classificationId: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("classification_memberships")
    .select("pseudonym")
    .eq("classification_id", classificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.pseudonym) return existing.pseudonym;

  const { data: taken } = await supabase
    .from("classification_memberships")
    .select("pseudonym")
    .eq("classification_id", classificationId)
    .not("pseudonym", "is", null);

  const used = new Set((taken ?? []).map((r: { pseudonym: string | null }) => r.pseudonym));

  const seed = hashSeed(`${userId}:${classificationId}`);
  let pseudonym = "";
  for (let i = 0; i < MYSTERY_ANIMALS.length; i++) {
    const candidate = MYSTERY_ANIMALS[(seed + i) % MYSTERY_ANIMALS.length];
    if (!used.has(candidate)) {
      pseudonym = candidate;
      break;
    }
  }
  // If every animal is taken (>60 entrants), fall back to numeric suffix on
  // the seed-preferred animal. Vanishingly rare for Phase 1 but worth
  // covering — beats throwing.
  if (!pseudonym) {
    const base = MYSTERY_ANIMALS[seed % MYSTERY_ANIMALS.length];
    let suffix = 2;
    while (used.has(`${base} ${suffix}`)) suffix++;
    pseudonym = `${base} ${suffix}`;
  }

  await supabase
    .from("classification_memberships")
    .update({ pseudonym })
    .eq("classification_id", classificationId)
    .eq("user_id", userId);

  return pseudonym;
}

/**
 * Generate a deterministic pseudonym from a user_id, avoiding collisions
 * with names already in `usedNames`. Same algorithm as ensurePseudonym
 * but synchronous and non-persisting — for read-only public views.
 *
 * On the archive/display site, produces full names like "Badger Lynch"
 * by pairing the animal with a surname from DISPLAY_SURNAMES.
 */
export function generatePseudonym(userId: string, usedNames: Set<string>): string {
  const seed = hashSeed(userId);
  const isArchive =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_archive" ||
     process.env.PRODUCT_MODE === "world_cup_2026_archive");

  if (isArchive) {
    // Full name: "Animal Surname" — deterministic from user_id
    const animal = MYSTERY_ANIMALS[seed % MYSTERY_ANIMALS.length];
    const surname = DISPLAY_SURNAMES[hashSeed(`${userId}:surname`) % DISPLAY_SURNAMES.length];
    const candidate = `${animal} ${surname}`;
    if (!usedNames.has(candidate)) return candidate;
    // Collision: walk animals until we find an unused combo
    for (let i = 1; i < MYSTERY_ANIMALS.length; i++) {
      const alt = `${MYSTERY_ANIMALS[(seed + i) % MYSTERY_ANIMALS.length]} ${surname}`;
      if (!usedNames.has(alt)) return alt;
    }
    // Extreme fallback
    let suffix = 2;
    while (usedNames.has(`${candidate} ${suffix}`)) suffix++;
    return `${candidate} ${suffix}`;
  }

  // Standard mode: animal-only pseudonyms
  for (let i = 0; i < MYSTERY_ANIMALS.length; i++) {
    const candidate = MYSTERY_ANIMALS[(seed + i) % MYSTERY_ANIMALS.length];
    if (!usedNames.has(candidate)) return candidate;
  }
  // All 60 animals taken — add numeric suffix
  const base = MYSTERY_ANIMALS[seed % MYSTERY_ANIMALS.length];
  let suffix = 2;
  while (usedNames.has(`${base} ${suffix}`)) suffix++;
  return `${base} ${suffix}`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
