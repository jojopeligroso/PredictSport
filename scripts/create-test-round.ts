import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = "66f6a822-b20b-402a-977d-18e8f03e4ce1"; // Eoin

async function main() {
  const now = new Date();
  const lockTime = new Date(now.getTime() + 20 * 60 * 1000); // 20 min
  const startTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min

  console.log(`Lock time: ${lockTime.toISOString()}`);

  // Create competition
  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .insert({
      name: "Telegram Test Round",
      type: "fixed",
      visibility: "private",
      status: "active",
      allow_prediction_updates: true,
      scoring_rules: { points: { winner: 10 } },
      created_by: USER_ID,
    })
    .select("id")
    .single();

  if (compErr) throw new Error(`Competition: ${compErr.message}`);
  console.log(`Competition: ${comp.id}`);

  // Add Eoin as admin
  const { error: memErr } = await supabase
    .from("competition_members")
    .insert({ competition_id: comp.id, user_id: USER_ID, role: "admin" });
  if (memErr) throw new Error(`Member: ${memErr.message}`);

  // Create round
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      competition_id: comp.id,
      round_number: 1,
      name: "Round 1",
      status: "open",
    })
    .select("id")
    .single();
  if (roundErr) throw new Error(`Round: ${roundErr.message}`);
  console.log(`Round: ${round.id}`);

  // Create events
  const events = [
    "Man City vs Liverpool",
    "Arsenal vs Chelsea",
    "Wexford vs Waterford",
  ];

  for (const name of events) {
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .insert({
        competition_id: comp.id,
        round_id: round.id,
        event_name: name,
        sport: "soccer",
        lock_time: lockTime.toISOString(),
        start_time: startTime.toISOString(),
        status: "upcoming",
      })
      .select("id")
      .single();

    if (eventErr) throw new Error(`Event ${name}: ${eventErr.message}`);

    // Add winner prediction type
    await supabase.from("event_prediction_types").insert({
      event_id: event.id,
      prediction_type: "winner",
      points: 10,
      partial_points: 0,
    });

    console.log(`Event: ${event.id} — ${name}`);
  }

  console.log("\nDone! Now run /post in the Telegram group.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
