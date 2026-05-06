/**
 * Seed script: Wexford FC Sports Prediction Quiz 2026
 *
 * Creates the full competition from the PDF prediction sheet:
 * - 1 competition with scoring_rules (classic_quiz preset)
 * - 1 round ("Main Round")
 * - 36 events (Q8 and Q16 split into 2 events each = 34 questions → 36 events)
 * - event_prediction_types rows for each event
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

// Parse .env.local manually (avoid dotenv dependency)
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
    // File not found — env vars must be set externally
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
// Event definitions from the PDF
// ---------------------------------------------------------------------------

interface EventDef {
  question: number;
  event_name: string;
  sport: string;
  date: string; // approximate date, YYYY-MM-DD
  prediction_types: Array<{
    prediction_type: string;
    points: number;
    partial_points: number;
    config: Record<string, unknown> | null;
  }>;
}

const EVENTS: EventDef[] = [
  // Q1
  {
    question: 1,
    event_name:
      "Will Ireland have 18 winners or more at the 2026 Cheltenham Festival?",
    sport: "horse_racing",
    date: "2026-03-13",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Yes", "No"] },
      },
    ],
  },
  // Q2
  {
    question: 2,
    event_name: "Winner of Rugby Six Nations 2026",
    sport: "rugby",
    date: "2026-03-14",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q3
  {
    question: 3,
    event_name: "National Mens Football League Champions",
    sport: "gaa",
    date: "2026-03-29",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q4
  {
    question: 4,
    event_name:
      "Will the Aintree Grand National Winner be trained in Ireland or the UK?",
    sport: "horse_racing",
    date: "2026-04-11",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Ireland", "UK"] },
      },
    ],
  },
  // Q5
  {
    question: 5,
    event_name: "National Mens Hurling League Champions",
    sport: "gaa",
    date: "2026-04-06",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q6
  {
    question: 6,
    event_name: "US Masters Winner",
    sport: "golf",
    date: "2026-04-12",
    prediction_types: [
      {
        prediction_type: "top_n",
        points: 10,
        partial_points: 5,
        config: { n: 5 },
      },
    ],
  },
  // Q7
  {
    question: 7,
    event_name: "World Snooker Championship Winner",
    sport: "snooker",
    date: "2026-05-04",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q8 — split into two events
  {
    question: 8,
    event_name: "GAA Ulster Football Champions",
    sport: "gaa",
    date: "2026-05-10",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  {
    question: 8,
    event_name: "GAA Connacht Football Champions",
    sport: "gaa",
    date: "2026-05-10",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q9
  {
    question: 9,
    event_name: "FA Cup Final Winners",
    sport: "soccer",
    date: "2026-05-16",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q10
  {
    question: 10,
    event_name: "UEFA Europa League Winners",
    sport: "soccer",
    date: "2026-05-20",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q11
  {
    question: 11,
    event_name: "European Champions Cup (Heineken Cup) Winners",
    sport: "rugby",
    date: "2026-05-23",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q12
  {
    question: 12,
    event_name: "Premier League Winners",
    sport: "soccer",
    date: "2026-05-24",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q13
  {
    question: 13,
    event_name: "Will Manchester United finish in the Premier League Top 4?",
    sport: "soccer",
    date: "2026-05-24",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Yes", "No"] },
      },
    ],
  },
  // Q14
  {
    question: 14,
    event_name: "UEFA Champions League Winners",
    sport: "soccer",
    date: "2026-05-30",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q15
  {
    question: 15,
    event_name: "Will the Epsom Derby Winner be trained in Ireland or the UK?",
    sport: "horse_racing",
    date: "2026-06-06",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Ireland", "UK"] },
      },
    ],
  },
  // Q16 — split into two events
  {
    question: 16,
    event_name: "GAA Munster Hurling Champions",
    sport: "gaa",
    date: "2026-06-07",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  {
    question: 16,
    event_name: "GAA Leinster Hurling Champions",
    sport: "gaa",
    date: "2026-06-07",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q17
  {
    question: 17,
    event_name: "Women's Singles Winner - Wimbledon",
    sport: "tennis",
    date: "2026-07-11",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q18
  {
    question: 18,
    event_name: "Men's Singles Winner - Wimbledon",
    sport: "tennis",
    date: "2026-07-12",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q19
  {
    question: 19,
    event_name: "Will Republic of Ireland qualify for 2026 Soccer World Cup?",
    sport: "soccer",
    date: "2026-07-19",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Yes", "No"] },
      },
    ],
  },
  // Q20
  {
    question: 20,
    event_name: "Winner of 2026 Soccer World Cup",
    sport: "soccer",
    date: "2026-07-19",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q21
  {
    question: 21,
    event_name: "Will England reach the Semi-Finals of the Soccer World Cup?",
    sport: "soccer",
    date: "2026-07-19",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Yes", "No"] },
      },
    ],
  },
  // Q22
  {
    question: 22,
    event_name: "All-Ireland Senior Hurling Champions",
    sport: "gaa",
    date: "2026-07-19",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q23
  {
    question: 23,
    event_name: "British Open Golf Champion",
    sport: "golf",
    date: "2026-07-19",
    prediction_types: [
      {
        prediction_type: "top_n",
        points: 10,
        partial_points: 5,
        config: { n: 5 },
      },
    ],
  },
  // Q24
  {
    question: 24,
    event_name: "All-Ireland Senior Football Champions",
    sport: "gaa",
    date: "2026-07-26",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q25
  {
    question: 25,
    event_name: "All-Ireland Senior Ladies Football Champions",
    sport: "gaa",
    date: "2026-08-02",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q26
  {
    question: 26,
    event_name: "All-Ireland Senior Camogie Champions",
    sport: "gaa",
    date: "2026-08-08",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q27
  {
    question: 27,
    event_name: "Who will win the Solheim Cup?",
    sport: "golf",
    date: "2026-09-13",
    prediction_types: [
      {
        prediction_type: "yes_no",
        points: 10,
        partial_points: 0,
        config: { options: ["Europe", "USA"] },
      },
    ],
  },
  // Q28
  {
    question: 28,
    event_name: "SSE Airtricity Mens Premier League Champions",
    sport: "soccer",
    date: "2026-11-01",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q29
  {
    question: 29,
    event_name: "Mens FAI Cup Champions",
    sport: "soccer",
    date: "2026-11-15",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q30
  {
    question: 30,
    event_name: "SSE Airtricity Womens Premier League Champions",
    sport: "soccer",
    date: "2026-11-01",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q31
  {
    question: 31,
    event_name: "Womens FAI Cup Champions",
    sport: "soccer",
    date: "2026-11-15",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q32
  {
    question: 32,
    event_name: "Senior Mens Footballer of the Year (GAA All-Stars)",
    sport: "gaa",
    date: "2026-11-15",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q33
  {
    question: 33,
    event_name: "Senior Mens Hurler of the Year (GAA All-Stars)",
    sport: "gaa",
    date: "2026-11-15",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
  // Q34
  {
    question: 34,
    event_name: "Formula 1 Drivers Championship 2026 Winner",
    sport: "formula_1",
    date: "2026-12-06",
    prediction_types: [
      { prediction_type: "winner", points: 10, partial_points: 0, config: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Wexford FC Sports Prediction Quiz 2026...\n");

  // Step 1: Find or create the admin user
  // We'll use the first user in the system as the competition creator
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, display_name")
    .limit(1);

  if (usersError || !users || users.length === 0) {
    console.error(
      "No users found. Log in to the app first to create a user profile."
    );
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

  // Step 3: Create competition
  const scoringRules = {
    preset: "classic_quiz",
    points: {
      winner: 10, top_n: 10, head_to_head: 10,
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
      description:
        "Simply predict the outcome of the sporting events below. 10 points per correct answer. Entry fee: \u20AC20.",
      type: "fixed",
      visibility: "private",
      status: "draft",
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

  console.log(`Created competition: ${competition.id}`);

  // Step 4: Add admin as member
  await supabase.from("competition_members").insert({
    competition_id: competition.id,
    user_id: adminUser.id,
    role: "admin",
  });

  // Step 5: Create round
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      competition_id: competition.id,
      name: "Main Round",
      round_number: 1,
      status: "draft",
    })
    .select()
    .single();

  if (roundError) {
    console.error("Failed to create round:", roundError.message);
    process.exit(1);
  }

  console.log(`Created round: ${round.id}`);

  // Step 6: Create events and event_prediction_types
  let eventCount = 0;
  let eptCount = 0;

  for (const def of EVENTS) {
    const startTime = new Date(`${def.date}T12:00:00Z`);
    const lockTime = new Date(startTime.getTime() - 5 * 60 * 1000); // 5 min before

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
      console.error(
        `Failed to create event Q${def.question} "${def.event_name}":`,
        eventError.message
      );
      continue;
    }

    eventCount++;

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
      console.error(
        `Failed to create prediction types for Q${def.question}:`,
        eptError.message
      );
    } else {
      eptCount += eptRows.length;
    }
  }

  console.log(`Created ${eventCount} events with ${eptCount} prediction type rows`);

  // Step 7: Create tiebreaker (Q35)
  const { error: tbError } = await supabase.from("tiebreakers").insert({
    competition_id: competition.id,
    question_text:
      "Total number of goals scored in the 2026 Soccer World Cup?",
  });

  if (tbError) {
    console.error("Failed to create tiebreaker:", tbError.message);
  } else {
    console.log("Created tiebreaker: Total World Cup goals");
  }

  // Summary
  console.log("\nSeed complete!");
  console.log(`  Competition: ${competition.name}`);
  console.log(`  ID: ${competition.id}`);
  console.log(`  Invite code: ${competition.invite_code}`);
  console.log(`  Events: ${eventCount}`);
  console.log(`  Prediction types: ${eptCount}`);
  console.log(`  Max possible points: ${EVENTS.reduce((sum, e) => sum + e.prediction_types.reduce((s, pt) => s + pt.points, 0), 0)}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
