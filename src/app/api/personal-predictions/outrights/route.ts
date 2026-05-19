import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";

const MAX_CHANGES = 2; // After tournament start, user can change pick up to 2 times (3 total including initial)

interface CreateOutrightBody {
  /** Unique league/tournament identifier, e.g. "eng.1" or "cricket/8044" */
  league_id: string;
  /** Display name, e.g. "Premier League 2025/26" */
  league_name: string;
  sport: string;
  /** The user's outright pick (team/driver/player name) */
  pick: string;
  /** Has the tournament already started? Controls change budget. */
  tournament_started?: boolean;
}

interface ChangeEntry {
  pick: string;
  changed_at: string;
}

/**
 * POST /api/personal-predictions/outrights
 *
 * Creates or updates an outright (final_standings) prediction for a
 * league/tournament in the user's personal competition.
 *
 * - First pick: always allowed (creates event + EPT + prediction)
 * - Before tournament start: freely editable (no budget consumed)
 * - After tournament start: max 2 changes (3 total picks incl. initial)
 *
 * Change history is stored in prediction_data.change_history as a
 * timestamped array for UI display and budget enforcement.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateOutrightBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.league_id || !body.league_name?.trim() || !body.sport || !body.pick?.trim()) {
    return NextResponse.json(
      { error: "league_id, league_name, sport, and pick are required" },
      { status: 400 },
    );
  }

  // Resolve personal competition
  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  const externalEventId = `outright:${body.league_id}`;

  // Check if outright event already exists
  const { data: existingEvent } = await supabase
    .from("events")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("external_event_id", externalEventId)
    .maybeSingle();

  if (existingEvent) {
    // Update existing outright — enforce change budget
    return await handleUpdate(
      supabase,
      user.id,
      existingEvent.id,
      body.pick.trim(),
      body.tournament_started ?? false,
    );
  }

  // Create new outright event + prediction
  return await handleCreate(
    supabase,
    user.id,
    competitionId,
    externalEventId,
    body,
  );
}

async function handleCreate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  competitionId: string,
  externalEventId: string,
  body: CreateOutrightBody,
) {
  // Use a far-future lock_time — outrights are open until resolved
  const farFuture = "2099-12-31T23:59:59Z";

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      competition_id: competitionId,
      round_id: null,
      event_name: `Who wins ${body.league_name.trim()}?`,
      sport: body.sport,
      start_time: farFuture,
      lock_time: farFuture,
      external_event_id: externalEventId,
      provider_league: body.league_id,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (eventError) {
    // Race condition — another request created it
    if (eventError.code === "23505") {
      const { data: raced } = await supabase
        .from("events")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("external_event_id", externalEventId)
        .maybeSingle();

      if (raced) {
        return await handleUpdate(
          supabase,
          userId,
          raced.id,
          body.pick.trim(),
          body.tournament_started ?? false,
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to create outright event", details: eventError.message },
      { status: 500 },
    );
  }

  // Create event_prediction_type (final_standings, points=0)
  const { data: ept, error: eptError } = await supabase
    .from("event_prediction_types")
    .insert({
      event_id: event.id,
      prediction_type: "final_standings",
      points: 0,
      partial_points: 0,
      config: { positions: 1 },
    })
    .select("id")
    .single();

  if (eptError) {
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json(
      { error: "Failed to create prediction type", details: eptError.message },
      { status: 500 },
    );
  }

  // Create prediction
  const now = new Date().toISOString();
  const changeHistory: ChangeEntry[] = [{ pick: body.pick.trim(), changed_at: now }];

  const { data: prediction, error: predError } = await supabase
    .from("predictions")
    .insert({
      event_prediction_type_id: ept.id,
      event_id: event.id,
      user_id: userId,
      prediction_type: "final_standings",
      prediction_data: {
        value: body.pick.trim(),
        change_history: changeHistory,
        picked_pre_start: !(body.tournament_started ?? false),
      },
    })
    .select()
    .single();

  if (predError) {
    await supabase.from("event_prediction_types").delete().eq("id", ept.id);
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json(
      { error: "Failed to create prediction", details: predError.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      event_id: event.id,
      prediction,
      changes_remaining: MAX_CHANGES,
      created: true,
    },
    { status: 201 },
  );
}

async function handleUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
  newPick: string,
  tournamentStarted: boolean,
) {
  // Find the existing prediction
  const { data: prediction } = await supabase
    .from("predictions")
    .select("id, prediction_data")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("prediction_type", "final_standings")
    .maybeSingle();

  if (!prediction) {
    // No prediction yet — resolve EPT and create one
    const { data: ept } = await supabase
      .from("event_prediction_types")
      .select("id")
      .eq("event_id", eventId)
      .eq("prediction_type", "final_standings")
      .single();

    if (!ept) {
      return NextResponse.json({ error: "Prediction type not found" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data: created, error: insertError } = await supabase
      .from("predictions")
      .insert({
        event_prediction_type_id: ept.id,
        event_id: eventId,
        user_id: userId,
        prediction_type: "final_standings",
        prediction_data: {
          value: newPick,
          change_history: [{ pick: newPick, changed_at: now }],
          picked_pre_start: !tournamentStarted,
        },
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create prediction", details: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      event_id: eventId,
      prediction: created,
      changes_remaining: MAX_CHANGES,
      created: true,
    });
  }

  // Existing prediction — check change budget
  const data = prediction.prediction_data as Record<string, unknown>;
  const history = (data.change_history ?? []) as ChangeEntry[];
  const currentPick = data.value as string;

  // No-op if pick hasn't changed
  if (currentPick === newPick) {
    return NextResponse.json({
      event_id: eventId,
      prediction,
      changes_remaining: computeRemaining(history, tournamentStarted),
      created: false,
    });
  }

  // Before tournament starts: freely editable, no budget consumed
  // After tournament starts: enforce change budget
  if (tournamentStarted) {
    // Count changes made after initial pick (history[0] is initial)
    const changesUsed = Math.max(0, history.length - 1);
    if (changesUsed >= MAX_CHANGES) {
      return NextResponse.json(
        {
          error: "Change budget exhausted",
          changes_remaining: 0,
          change_history: history,
        },
        { status: 403 },
      );
    }
  }

  const now = new Date().toISOString();
  const newHistory = tournamentStarted
    ? [...history, { pick: newPick, changed_at: now }]
    : [{ pick: newPick, changed_at: now }]; // Pre-start: replace history entirely

  const { data: updated, error: updateError } = await supabase
    .from("predictions")
    .update({
      prediction_data: {
        value: newPick,
        change_history: newHistory,
      },
      updated_at: now,
    })
    .eq("id", prediction.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update prediction", details: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    event_id: eventId,
    prediction: updated,
    changes_remaining: computeRemaining(newHistory, tournamentStarted),
    created: false,
  });
}

function computeRemaining(history: ChangeEntry[], tournamentStarted: boolean): number {
  if (!tournamentStarted) return MAX_CHANGES;
  const changesUsed = Math.max(0, history.length - 1);
  return Math.max(0, MAX_CHANGES - changesUsed);
}

/**
 * GET /api/personal-predictions/outrights
 *
 * Returns all outright predictions for the current user.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Fetch all outright events (external_event_id starts with 'outright:')
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id,
      event_name,
      sport,
      provider_league,
      external_event_id,
      status,
      result_data,
      result_confirmed
    `)
    .eq("competition_id", competitionId)
    .like("external_event_id", "outright:%")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch outrights", details: error.message },
      { status: 500 },
    );
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ outrights: [] });
  }

  // Fetch predictions for these events
  const eventIds = events.map((e) => e.id);
  const { data: predictions } = await supabase
    .from("predictions")
    .select("event_id, prediction_data, is_correct")
    .eq("user_id", user.id)
    .in("event_id", eventIds);

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.event_id, p]),
  );

  // Determine which leagues have started by checking for fixture events
  // with start_time in the past (outright events use far-future start_time)
  const leagues = [...new Set(events.map((e) => e.provider_league).filter(Boolean))] as string[];
  const startedLeagues = new Set<string>();
  if (leagues.length > 0) {
    const now = new Date().toISOString();
    const { data: fixtureEvents } = await supabase
      .from("events")
      .select("provider_league")
      .eq("competition_id", competitionId)
      .in("provider_league", leagues)
      .not("external_event_id", "like", "outright:%")
      .lt("start_time", now);
    for (const fe of fixtureEvents ?? []) {
      if (fe.provider_league) startedLeagues.add(fe.provider_league);
    }
  }

  const outrights = events.map((e) => {
    const pred = predMap.get(e.id);
    const data = pred?.prediction_data as Record<string, unknown> | undefined;
    const pickedPreStart = (data?.picked_pre_start as boolean | undefined) ?? true;
    const leagueStarted = e.provider_league ? startedLeagues.has(e.provider_league) : false;
    return {
      event_id: e.id,
      league_id: e.external_event_id?.replace("outright:", "") ?? null,
      league_name: e.event_name.replace("Who wins ", "").replace("?", ""),
      sport: e.sport,
      pick: data?.value ?? null,
      change_history: (data?.change_history ?? []) as ChangeEntry[],
      is_correct: pred?.is_correct ?? null,
      status: e.status,
      result_data: e.result_data,
      tournament_started: leagueStarted,
      picked_pre_start: pickedPreStart,
    };
  });

  return NextResponse.json({ outrights });
}
