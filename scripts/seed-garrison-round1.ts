import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import roundData from "../garrison-games-round-1.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EOIN_USER_ID = "66f6a822-b20b-402a-977d-18e8f03e4ce1";

async function main() {
  // Re-link Eoin's Telegram
  await supabase
    .from("users")
    .update({ telegram_id: 406278300, telegram_username: "EoinMalone", display_name: "Eoin" })
    .eq("id", EOIN_USER_ID);
  console.log("Linked Telegram for Eoin");

  // Create competition
  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .insert({
      name: roundData.competition,
      type: "fixed",
      visibility: "private",
      status: "active",
      allow_prediction_updates: true,
      scoring_rules: { points: { winner: 10 } },
      created_by: EOIN_USER_ID,
    })
    .select("id")
    .single();
  if (compErr) throw new Error(`Competition: ${compErr.message}`);
  console.log(`Competition: ${comp.id} — ${roundData.competition}`);

  // Add Eoin as admin
  await supabase
    .from("competition_members")
    .insert({ competition_id: comp.id, user_id: EOIN_USER_ID, role: "admin" });

  // Create round
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      competition_id: comp.id,
      round_number: roundData.round,
      name: `Round ${roundData.round}`,
      status: "open",
    })
    .select("id")
    .single();
  if (roundErr) throw new Error(`Round: ${roundErr.message}`);
  console.log(`Round: ${round.id}`);

  // Create events — lock_time = fixture start time
  for (const fix of roundData.fixtures) {
    const startDateTime = `${fix.date}T${fix.time}:00`;
    // Parse as Europe/Dublin time
    const startDate = new Date(startDateTime + "+01:00"); // IST = UTC+1
    const lockTime = startDate.toISOString();

    const eventName = `${fix.home} vs ${fix.away}`;

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .insert({
        competition_id: comp.id,
        round_id: round.id,
        event_name: eventName,
        sport: fix.sport.toLowerCase(),
        lock_time: lockTime,
        start_time: lockTime,
        status: "upcoming",
      })
      .select("id")
      .single();

    if (eventErr) {
      console.error(`Event ${eventName}: ${eventErr.message}`);
      continue;
    }

    // Add winner prediction type
    await supabase.from("event_prediction_types").insert({
      event_id: event.id,
      prediction_type: "winner",
      points: 10,
      partial_points: 0,
    });

    console.log(`  ${fix.time} ${eventName} (locks ${lockTime})`);
  }

  console.log("\nDone! Send /post in the Telegram group.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
