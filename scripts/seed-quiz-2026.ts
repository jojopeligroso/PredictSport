/**
 * Seed script: Wexford FC Sports Prediction Quiz 2026
 *
 * Creates the full competition from the working spreadsheet:
 * - 1 competition with scoring_rules (classic_quiz preset)
 * - 1 round ("Main Round")
 * - 36 events (Q8 and Q16 split into 2 events each = 34 questions -> 36 events)
 * - event_prediction_types rows for each event
 * - 12 participants with all their predictions
 * - 1 tiebreaker (Q35: total World Cup goals)
 *
 * Usage:
 *   npx tsx scripts/seed-quiz-2026.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Uses the service role key to bypass RLS.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(resolve(filePath), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File not found
  }
}

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

const PARTICIPANTS = [
  { name: "Jay", email: "jay@wexfordfc-quiz.test" },
  { name: "Manning", email: "manning@wexfordfc-quiz.test" },
  { name: "Paddy", email: "paddy@wexfordfc-quiz.test" },
  { name: "Parker", email: "parker@wexfordfc-quiz.test" },
  { name: "Aidan", email: "aidan@wexfordfc-quiz.test" },
  { name: "Joyce", email: "joyce@wexfordfc-quiz.test" },
  { name: "Bohanna", email: "bohanna@wexfordfc-quiz.test" },
  { name: "Mick", email: "mick@wexfordfc-quiz.test" },
  { name: "Malone", email: "malone@wexfordfc-quiz.test" },
  { name: "Jimmy D", email: "jimmyd@wexfordfc-quiz.test" },
  { name: "JK", email: "jk@wexfordfc-quiz.test" },
  { name: "Scrooch", email: "scrooch@wexfordfc-quiz.test" },
];

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

interface EventDef {
  question: number;
  event_name: string;
  sport: string;
  date: string;
  prediction_types: Array<{
    prediction_type: string;
    points: number;
    partial_points: number;
    config: Record<string, unknown> | null;
  }>;
}

const EVENTS: EventDef[] = [
  { question: 1, event_name: "Will Ireland have 18 winners or more at the 2026 Cheltenham Festival?", sport: "horse_racing", date: "2026-03-13",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Yes", "No"] } }] },
  { question: 2, event_name: "Winner of Rugby Six Nations 2026", sport: "rugby", date: "2026-03-14",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 3, event_name: "National Mens Football League Champions", sport: "gaa", date: "2026-03-29",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 4, event_name: "Will the Aintree Grand National Winner be trained in Ireland or the UK?", sport: "horse_racing", date: "2026-04-11",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Ireland", "UK"] } }] },
  { question: 5, event_name: "National Mens Hurling League Champions", sport: "gaa", date: "2026-04-06",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 6, event_name: "US Masters Winner", sport: "golf", date: "2026-04-12",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 7, event_name: "World Snooker Championship Winner", sport: "snooker", date: "2026-05-04",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  // Q8 — split into two events (Ulster + Connacht)
  { question: 8, event_name: "GAA Ulster Football Champions", sport: "gaa", date: "2026-05-10",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 8.5, event_name: "GAA Connacht Football Champions", sport: "gaa", date: "2026-05-10",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 9, event_name: "FA Cup Final Winners", sport: "soccer", date: "2026-05-16",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 10, event_name: "UEFA Europa League Winners", sport: "soccer", date: "2026-05-20",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 11, event_name: "European Champions Cup (Heineken Cup) Winners", sport: "rugby", date: "2026-05-23",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 12, event_name: "Premier League Winners", sport: "soccer", date: "2026-05-24",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 13, event_name: "Will Manchester United finish in the Premier League Top 4?", sport: "soccer", date: "2026-05-24",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Yes", "No"] } }] },
  { question: 14, event_name: "UEFA Champions League Winners", sport: "soccer", date: "2026-05-30",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 15, event_name: "Will the Epsom Derby Winner be trained in Ireland or the UK?", sport: "horse_racing", date: "2026-06-06",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Ireland", "UK"] } }] },
  // Q16 — split into two events (Munster + Leinster)
  { question: 16, event_name: "GAA Munster Hurling Champions", sport: "gaa", date: "2026-06-07",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 16.5, event_name: "GAA Leinster Hurling Champions", sport: "gaa", date: "2026-06-07",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 17, event_name: "Women's Singles Winner - Wimbledon", sport: "tennis", date: "2026-07-11",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 18, event_name: "Men's Singles Winner - Wimbledon", sport: "tennis", date: "2026-07-12",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 19, event_name: "Will Republic of Ireland qualify for 2026 Soccer World Cup?", sport: "soccer", date: "2026-07-19",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Yes", "No"] } }] },
  { question: 20, event_name: "Winner of 2026 Soccer World Cup", sport: "soccer", date: "2026-07-19",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 21, event_name: "Will England reach the Semi-Finals of the Soccer World Cup?", sport: "soccer", date: "2026-07-19",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Yes", "No"] } }] },
  { question: 22, event_name: "All-Ireland Senior Hurling Champions", sport: "gaa", date: "2026-07-19",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 23, event_name: "British Open Golf Champion", sport: "golf", date: "2026-07-19",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 24, event_name: "All-Ireland Senior Football Champions", sport: "gaa", date: "2026-07-26",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 25, event_name: "All-Ireland Senior Ladies Football Champions", sport: "gaa", date: "2026-08-02",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 26, event_name: "All-Ireland Senior Camogie Champions", sport: "gaa", date: "2026-08-08",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 27, event_name: "Who will win the Solheim Cup?", sport: "golf", date: "2026-09-13",
    prediction_types: [{ prediction_type: "yes_no", points: 10, partial_points: 0, config: { options: ["Europe", "USA"] } }] },
  { question: 28, event_name: "SSE Airtricity Mens Premier League Champions", sport: "soccer", date: "2026-11-01",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 29, event_name: "Mens FAI Cup Champions", sport: "soccer", date: "2026-11-15",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 30, event_name: "SSE Airtricity Womens Premier League Champions", sport: "soccer", date: "2026-11-01",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 31, event_name: "Womens FAI Cup Champions", sport: "soccer", date: "2026-11-15",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 32, event_name: "Senior Mens Footballer of the Year (GAA All-Stars)", sport: "gaa", date: "2026-11-15",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 33, event_name: "Senior Mens Hurler of the Year (GAA All-Stars)", sport: "gaa", date: "2026-11-15",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
  { question: 34, event_name: "Formula 1 Drivers Championship 2026 Winner", sport: "formula_1", date: "2026-12-06",
    prediction_types: [{ prediction_type: "winner", points: 10, partial_points: 0, config: null }] },
];

// ---------------------------------------------------------------------------
// Predictions from the working spreadsheet
// Key: question number (8.5 = Q8 Connacht half, 16.5 = Q16 Leinster half)
// Values: array of answers in PARTICIPANTS order
// ---------------------------------------------------------------------------

type PredType = "winner" | "yes_no" | "top_n";

interface PredictionRow {
  question: number;
  type: PredType;
  answers: string[];
}

// Answers in order: Jay, Manning, Paddy, Parker, Aidan, Joyce, Bohanna, Mick, Malone, Jimmy D, JK, Scrooch
const PREDICTIONS: PredictionRow[] = [
  { question: 1, type: "yes_no", answers: ["Yes", "No", "No", "Yes", "Yes", "Yes", "No", "Yes", "No", "No", "Yes", "Yes"] },
  { question: 2, type: "winner", answers: ["France", "France", "France", "France", "France", "Scotland", "France", "France", "France", "France", "France", "France"] },
  { question: 3, type: "winner", answers: ["Donegal", "Donegal", "Donegal", "Mayo", "Donegal", "Donegal", "Donegal", "Kerry", "Mayo", "Kerry", "Kerry", "Donegal"] },
  { question: 4, type: "yes_no", answers: ["Ireland", "Ireland", "UK", "Ireland", "Ireland", "UK", "Ireland", "Ireland", "UK", "Ireland", "Ireland", "Ireland"] },
  { question: 5, type: "winner", answers: ["Cork", "Cork", "Limerick", "Cork", "Limerick", "Limerick", "Limerick", "Limerick", "Limerick", "Limerick", "Cork", "Cork"] },
  { question: 6, type: "winner", answers: ["Scottie Scheffler", "Rory McIlroy", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler", "Scottie Scheffler"] },
  { question: 7, type: "winner", answers: ["Judd Trump", "Zhao Xintong", "Mark Selby", "Mark Selby", "Judd Trump", "Judd Trump", "Judd Trump", "Judd Trump", "Mark Selby", "Mark Williams", "Judd Trump", "Judd Trump"] },
  // Q8 split: Ulster champion
  { question: 8, type: "winner", answers: ["Donegal", "Donegal", "Donegal", "Donegal", "Donegal", "Armagh", "Donegal", "Donegal", "Donegal", "Donegal", "Tyrone", "Donegal"] },
  // Q8 split: Connacht champion
  { question: 8.5, type: "winner", answers: ["Mayo", "Galway", "Mayo", "Galway", "Galway", "Mayo", "Mayo", "Galway", "Mayo", "Mayo", "Mayo", "Galway"] },
  { question: 9, type: "winner", answers: ["Arsenal", "Arsenal", "Manchester City", "Liverpool", "Arsenal", "Arsenal", "Manchester City", "Manchester City", "Arsenal", "Arsenal", "Manchester City", "Manchester City"] },
  { question: 10, type: "winner", answers: ["Aston Villa", "Roma", "Porto", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa", "Aston Villa"] },
  { question: 11, type: "winner", answers: ["Bordeaux Begles", "Leinster", "Bordeaux Begles", "Leinster", "Leinster", "Bordeaux Begles", "Bordeaux Begles", "Leinster", "Leinster", "Leinster", "Bordeaux Begles", "Bordeaux Begles"] },
  { question: 12, type: "winner", answers: ["Arsenal", "Arsenal", "Manchester City", "Arsenal", "Arsenal", "Arsenal", "Arsenal", "Manchester City", "Arsenal", "Arsenal", "Arsenal", "Arsenal"] },
  { question: 13, type: "yes_no", answers: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "No", "No", "Yes", "Yes", "Yes"] },
  { question: 14, type: "winner", answers: ["Bayern Munich", "Bayern Munich", "Real Madrid", "Arsenal", "Arsenal", "Barcelona", "Barcelona", "Real Madrid", "Bayern Munich", "Real Madrid", "Barcelona", "Bayern Munich"] },
  { question: 15, type: "yes_no", answers: ["Ireland", "Ireland", "Ireland", "Ireland", "Ireland", "Ireland", "Ireland", "Ireland", "UK", "Ireland", "UK", "Ireland"] },
  // Q16 split: Munster Hurling
  { question: 16, type: "winner", answers: ["Limerick", "Cork", "Limerick", "Cork", "Limerick", "Limerick", "Limerick", "Limerick", "Cork", "Limerick", "Limerick", "Cork"] },
  // Q16 split: Leinster Hurling
  { question: 16.5, type: "winner", answers: ["Kilkenny", "Kilkenny", "Galway", "Galway", "Galway", "Kilkenny", "Galway", "Kilkenny", "Kilkenny", "Kilkenny", "Kilkenny", "Kilkenny"] },
  { question: 17, type: "winner", answers: ["Aryna Sabalenka", "Aryna Sabalenka", "Aryna Sabalenka", "Elena Rybakina", "Aryna Sabalenka", "Aryna Sabalenka", "Iga Swiatek", "Iga Swiatek", "Aryna Sabalenka", "Aryna Sabalenka", "Aryna Sabalenka", "Aryna Sabalenka"] },
  { question: 18, type: "winner", answers: ["Carlos Alcaraz", "Jannik Sinner", "Jannik Sinner", "Carlos Alcaraz", "Carlos Alcaraz", "Jannik Sinner", "Carlos Alcaraz", "Carlos Alcaraz", "Carlos Alcaraz", "Carlos Alcaraz", "Carlos Alcaraz", "Carlos Alcaraz"] },
  { question: 19, type: "yes_no", answers: ["Yes", "No", "Yes", "Yes", "Yes", "No", "No", "No", "No", "No", "Yes", "No"] },
  { question: 20, type: "winner", answers: ["France", "Brazil", "Norway", "Spain", "Spain", "Spain", "Brazil", "France", "Spain", "Spain", "Spain", "Argentina"] },
  { question: 21, type: "yes_no", answers: ["No", "Yes", "No", "Yes", "Yes", "Yes", "Yes", "Yes", "No", "No", "Yes", "No"] },
  { question: 22, type: "winner", answers: ["Limerick", "Kilkenny", "Limerick", "Cork", "Limerick", "Limerick", "Limerick", "Limerick", "Kilkenny", "Limerick", "Limerick", "Limerick"] },
  { question: 23, type: "winner", answers: ["Rory McIlroy", "Rory McIlroy", "Rory McIlroy", "Scottie Scheffler", "Scottie Scheffler", "Jon Rahm", "Rory McIlroy", "Rory McIlroy", "Scottie Scheffler", "Scottie Scheffler", "Rory McIlroy", "Rory McIlroy"] },
  { question: 24, type: "winner", answers: ["Donegal", "Kerry", "Kerry", "Donegal", "Kerry", "Kerry", "Kerry", "Dublin", "Mayo", "Kerry", "Kerry", "Kerry"] },
  { question: 25, type: "winner", answers: ["Dublin", "Dublin", "Dublin", "Kerry", "Dublin", "Dublin", "Dublin", "Dublin", "Galway", "Kerry", "Dublin", "Galway"] },
  { question: 26, type: "winner", answers: ["Cork", "Galway", "Cork", "Cork", "Galway", "Cork", "Cork", "Kilkenny", "Galway", "Galway", "Cork", "Cork"] },
  { question: 27, type: "yes_no", answers: ["USA", "USA", "Europe", "Europe", "USA", "USA", "Europe", "Europe", "Europe", "Europe", "USA", "USA"] },
  { question: 28, type: "winner", answers: ["Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "Shamrock Rovers", "St. Pats", "Bohemians"] },
  { question: 29, type: "winner", answers: ["Bohemians", "Shamrock Rovers", "Derry City", "St Pats", "Shamrock Rovers", "Derry City", "Derry City", "Derry City", "Shelbourne", "Derry City", "St. Pats", "St. Pats"] },
  { question: 30, type: "winner", answers: ["Athlone Town", "Shelbourne", "Shelbourne", "Athlone Town", "Athlone Town", "Athlone Town", "Athlone Town", "Shelbourne", "Athlone Town", "Athlone Town", "Shelbourne", "Athlone Town"] },
  { question: 31, type: "winner", answers: ["Athlone Town", "Athlone Town", "Wexford FC", "Shelbourne", "Athlone Town", "Shelbourne", "Shelbourne", "Peamount United", "Athlone Town", "Peamount United", "Athlone Town", "Athlone Town"] },
  { question: 32, type: "winner", answers: ["Finnbarr Roarty", "David Clifford", "David Clifford", "Michael Langan", "David Clifford", "David Clifford", "David Clifford", "David Clifford", "Kobe MacDonald", "David Clifford", "David Clifford", "David Clifford"] },
  { question: 33, type: "winner", answers: ["Nickie Quaid", "Eoin Cody", "Cathal O'Neill", "Darragh Fitzgibbon", "Darragh McCarthy", "Aaron Gillane", "Aaron Gillane", "Gearoid Hegarty", "Darragh Fitzgibbon", "Adam English", "Brian Hayes", "Aidan O'Connor"] },
  { question: 34, type: "winner", answers: ["Max Verstappen", "George Russell", "Max Verstappen", "George Russell", "George Russell", "George Russell", "George Russell", "Max Verstappen", "George Russell", "Charles Leclerc", "Max Verstappen", "George Russell"] },
];

// Q35 tiebreaker answers (total World Cup goals)
const TIEBREAKER_ANSWERS = [205, 260, 277, 284, 280, 288, 305, 176, 281, 281, 222, 209];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Wexford FC Sports Prediction Quiz 2026...\n");

  // Step 1: Find or create the admin user
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, display_name")
    .limit(1);

  if (usersError || !users || users.length === 0) {
    console.error("No users found. Log in to the app first to create a user profile.");
    process.exit(1);
  }

  const adminUser = users[0];
  console.log(`Using admin user: ${adminUser.display_name} (${adminUser.email})`);

  // Step 2: Delete existing seed data (if re-running)
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("name", "Wexford FC Sports Prediction Quiz 2026")
    .maybeSingle();

  if (existing) {
    console.log("Deleting existing competition...");
    await supabase.from("competitions").delete().eq("id", existing.id);
  }

  // Clean up any existing test users from previous runs
  for (const p of PARTICIPANTS) {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", p.email)
      .maybeSingle();
    if (existingUser) {
      await supabase.auth.admin.deleteUser(existingUser.id);
    }
  }

  // Step 3: Create test participants via auth admin API
  console.log("Creating test participants...");
  const participantIds: string[] = [];

  for (const p of PARTICIPANTS) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: p.email,
      password: "testpassword123",
      email_confirm: true,
      user_metadata: { full_name: p.name },
    });

    if (authError) {
      console.error(`Failed to create user ${p.name}:`, authError.message);
      process.exit(1);
    }

    // Update display_name in public.users (trigger creates the row)
    await supabase
      .from("users")
      .update({ display_name: p.name })
      .eq("id", authUser.user.id);

    participantIds.push(authUser.user.id);
    console.log(`  Created: ${p.name} (${authUser.user.id})`);
  }

  // Step 4: Create competition
  const scoringRules = {
    preset: "classic_quiz",
    points: {
      winner: 10, top_n: 10, final_standings: 10, head_to_head: 10,
      margin: 20, over_under: 10, handicap: 10,
      yes_no: 10, progression: 10,
    },
    partial_credit: true,
    partial_points: { margin: 10, top_n: 5 },
  };

  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: "Wexford FC Sports Prediction Quiz 2026",
      description: "Simply predict the outcome of the sporting events below. 10 points per correct answer. Entry fee: \u20AC20.",
      type: "fixed",
      visibility: "private",
      status: "active",
      scoring_rules: scoringRules,
      lock_default_minutes: 5,
      allow_nominations: false,
      allow_prediction_updates: true,
      created_by: adminUser.id,
    })
    .select()
    .single();

  if (compError) {
    console.error("Failed to create competition:", compError.message);
    process.exit(1);
  }

  console.log(`\nCreated competition: ${competition.id}`);

  // Step 5: Add admin + all participants as members
  await supabase.from("competition_members").insert({
    competition_id: competition.id,
    user_id: adminUser.id,
    role: "admin",
  });

  for (const pid of participantIds) {
    await supabase.from("competition_members").insert({
      competition_id: competition.id,
      user_id: pid,
      role: "participant",
    });
  }

  console.log(`Added ${participantIds.length + 1} members`);

  // Step 6: Create round
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      competition_id: competition.id,
      name: "Main Round",
      round_number: 1,
      status: "open",
    })
    .select()
    .single();

  if (roundError) {
    console.error("Failed to create round:", roundError.message);
    process.exit(1);
  }

  console.log(`Created round: ${round.id}`);

  // Step 7: Create events, event_prediction_types, and predictions
  let eventCount = 0;
  let eptCount = 0;
  let predCount = 0;

  // Map question number to event_id for prediction insertion
  const eventMap = new Map<number, { id: string; prediction_type: string }>();

  for (const def of EVENTS) {
    const startTime = new Date(`${def.date}T12:00:00Z`);
    const lockTime = new Date(startTime.getTime() - 5 * 60 * 1000);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        competition_id: competition.id,
        round_id: round.id,
        event_name: def.event_name,
        sport: def.sport,
        start_time: startTime.toISOString(),
        lock_time: lockTime.toISOString(),
        status: "upcoming",
      })
      .select()
      .single();

    if (eventError) {
      console.error(`Failed to create event Q${def.question} "${def.event_name}":`, eventError.message);
      continue;
    }

    eventCount++;
    eventMap.set(def.question, {
      id: event.id,
      prediction_type: def.prediction_types[0].prediction_type,
    });

    // Insert event_prediction_types
    const eptRows = def.prediction_types.map((pt) => ({
      event_id: event.id,
      prediction_type: pt.prediction_type,
      points: pt.points,
      partial_points: pt.partial_points,
      config: pt.config,
    }));

    const { error: eptError } = await supabase
      .from("event_prediction_types")
      .insert(eptRows);

    if (eptError) {
      console.error(`Failed to create prediction types for Q${def.question}:`, eptError.message);
    } else {
      eptCount += eptRows.length;
    }
  }

  console.log(`Created ${eventCount} events with ${eptCount} prediction type rows`);

  // Step 8: Insert all predictions
  console.log("\nInserting predictions...");

  for (const row of PREDICTIONS) {
    const eventInfo = eventMap.get(row.question);
    if (!eventInfo) {
      console.error(`No event found for Q${row.question}`);
      continue;
    }

    const predRows = row.answers.map((answer, i) => {
      let prediction_data: Record<string, unknown>;

      if (row.type === "yes_no") {
        prediction_data = { selection: answer };
      } else {
        // winner / top_n
        prediction_data = { value: answer };
      }

      return {
        event_id: eventInfo.id,
        user_id: participantIds[i],
        prediction_type: eventInfo.prediction_type,
        prediction_data,
      };
    });

    const { error: predError } = await supabase
      .from("predictions")
      .insert(predRows);

    if (predError) {
      console.error(`Failed to insert predictions for Q${row.question}:`, predError.message);
    } else {
      predCount += predRows.length;
    }
  }

  console.log(`Inserted ${predCount} predictions`);

  // Note: Q35 tiebreaker (total World Cup goals) stored in TIEBREAKER_ANSWERS
  // but tiebreaker tables don't exist yet — skipping for now.

  // Summary
  console.log("\n=== Seed complete! ===");
  console.log(`  Competition: ${competition.name}`);
  console.log(`  ID: ${competition.id}`);
  console.log(`  Invite code: ${competition.invite_code}`);
  console.log(`  Events: ${eventCount}`);
  console.log(`  Prediction types: ${eptCount}`);
  console.log(`  Predictions: ${predCount}`);
  console.log(`  Participants: ${participantIds.length}`);
  console.log(`  Max possible points: ${EVENTS.reduce((sum, e) => sum + e.prediction_types.reduce((s, pt) => s + pt.points, 0), 0)}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
