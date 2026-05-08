import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { PredictionType, RoundStatus } from "@/types/database";

interface PredictionTypeInput {
  prediction_type: PredictionType;
  points?: number;
  partial_points?: number;
  config?: Record<string, unknown> | null;
}

interface EventInput {
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  external_event_id?: string;
  prediction_type_configs: PredictionTypeInput[];
}

interface CreateRoundBody {
  competition_id: string;
  name: string;
  round_number: number;
  deadline?: string;
  events?: EventInput[];
}

interface UpdateRoundBody {
  round_id: string;
  competition_id: string;
  name?: string;
  status?: RoundStatus;
  deadline?: string | null;
}

const VALID_SPORTS = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "mlb", "nfl", "nba", "nhl",
];

const VALID_PREDICTION_TYPES: PredictionType[] = [
  "winner", "top_n", "final_standings", "head_to_head", "margin",
  "over_under", "handicap", "yes_no", "progression",
];

const VALID_ROUND_STATUSES: RoundStatus[] = [
  "draft", "open", "locked", "scored",
];

const ALLOWED_ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  draft: ["open"],
  open: ["locked"],
  locked: ["scored"],
  scored: [],
};

const DEFAULT_POINTS: Record<PredictionType, number> = {
  winner: 10, top_n: 5, final_standings: 10, head_to_head: 5, margin: 10,
  over_under: 5, handicap: 5, yes_no: 10, progression: 10,
};

const DEFAULT_PARTIAL_POINTS: Record<string, number> = {
  margin: 5, top_n: 3,
};

function resolvePoints(
  input: PredictionTypeInput,
  scoringRules: Record<string, unknown>,
): { points: number; partial_points: number } {
  const srPoints = scoringRules.points as Record<string, number> | undefined;
  const srPartial = scoringRules.partial_points as Record<string, number> | undefined;

  return {
    points: input.points
      ?? srPoints?.[input.prediction_type]
      ?? DEFAULT_POINTS[input.prediction_type],
    partial_points: input.partial_points
      ?? srPartial?.[input.prediction_type]
      ?? DEFAULT_PARTIAL_POINTS[input.prediction_type]
      ?? 0,
  };
}

/**
 * GET /api/admin/rounds?competition_id=X
 * List all rounds for a competition.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const competitionId = searchParams.get("competition_id");

  if (!competitionId) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 }
    );
  }

  // Verify membership (any role can view rounds)
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this competition" },
      { status: 403 }
    );
  }

  const { data: rounds, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("competition_id", competitionId)
    .order("round_number", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch rounds", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ rounds });
}

/**
 * POST /api/admin/rounds
 * Create a round with events and event_prediction_types in one request.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateRoundBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 }
    );
  }

  const member = await verifyCompetitionAdmin(supabase, user.id, body.competition_id);
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Round name is required" },
      { status: 400 }
    );
  }

  if (body.round_number == null || body.round_number < 1) {
    return NextResponse.json(
      { error: "round_number must be a positive integer" },
      { status: 400 }
    );
  }

  const events = body.events ?? [];

  // Validate events
  for (const evt of events) {
    if (!evt.event_name?.trim()) {
      return NextResponse.json(
        { error: "Each event must have an event_name" },
        { status: 400 }
      );
    }
    if (!evt.sport || !VALID_SPORTS.includes(evt.sport)) {
      return NextResponse.json(
        { error: `Invalid sport: ${evt.sport}` },
        { status: 400 }
      );
    }
    if (!evt.start_time || !evt.lock_time) {
      return NextResponse.json(
        { error: `start_time and lock_time required for "${evt.event_name}"` },
        { status: 400 }
      );
    }
    if (!evt.prediction_type_configs?.length) {
      return NextResponse.json(
        { error: `At least one prediction type required for "${evt.event_name}"` },
        { status: 400 }
      );
    }
    for (const ptc of evt.prediction_type_configs) {
      if (!VALID_PREDICTION_TYPES.includes(ptc.prediction_type)) {
        return NextResponse.json(
          { error: `Invalid prediction type: ${ptc.prediction_type}` },
          { status: 400 }
        );
      }
    }
  }

  // Fetch competition scoring_rules for point defaults
  const { data: competition } = await supabase
    .from("competitions")
    .select("scoring_rules")
    .eq("id", body.competition_id)
    .single();

  const scoringRules = (competition?.scoring_rules ?? {}) as Record<string, unknown>;

  // 1. Create the round
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      competition_id: body.competition_id,
      name: body.name.trim(),
      round_number: body.round_number,
      deadline: body.deadline ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (roundError) {
    const isDuplicate = roundError.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicate
          ? `Round number ${body.round_number} already exists in this competition`
          : "Failed to create round",
        details: roundError.message,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  // If no events provided, return the round immediately
  if (events.length === 0) {
    return NextResponse.json(
      { round, events: [], event_count: 0 },
      { status: 201 }
    );
  }

  // 2. Create all events
  const eventRows = events.map((evt) => ({
    competition_id: body.competition_id,
    round_id: round.id,
    event_name: evt.event_name.trim(),
    sport: evt.sport,
    start_time: evt.start_time,
    lock_time: evt.lock_time,
    external_event_id: evt.external_event_id ?? null,
    status: "upcoming",
  }));

  const { data: createdEvents, error: eventsError } = await supabase
    .from("events")
    .insert(eventRows)
    .select();

  if (eventsError) {
    // Rollback: delete the round
    await supabase.from("rounds").delete().eq("id", round.id);
    return NextResponse.json(
      { error: "Failed to create events", details: eventsError.message },
      { status: 500 }
    );
  }

  // 3. Create event_prediction_types for each event
  const eptRows = createdEvents.flatMap((event, i) => {
    const configs = events[i].prediction_type_configs;
    return configs.map((ptc) => {
      const { points, partial_points } = resolvePoints(ptc, scoringRules);
      return {
        event_id: event.id,
        prediction_type: ptc.prediction_type,
        points,
        partial_points,
        config: ptc.config ?? null,
      };
    });
  });

  const { error: eptError } = await supabase
    .from("event_prediction_types")
    .insert(eptRows);

  if (eptError) {
    // Rollback: delete events and round
    await supabase.from("events").delete().eq("round_id", round.id);
    await supabase.from("rounds").delete().eq("id", round.id);
    return NextResponse.json(
      { error: "Failed to create prediction types", details: eptError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { round, events: createdEvents, event_count: createdEvents.length },
    { status: 201 }
  );
}

/**
 * PATCH /api/admin/rounds
 * Update round name, status, or deadline.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateRoundBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.round_id || !body.competition_id) {
    return NextResponse.json(
      { error: "round_id and competition_id are required" },
      { status: 400 }
    );
  }

  const member = await verifyCompetitionAdmin(supabase, user.id, body.competition_id);
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Validate status transition if provided
  if (body.status) {
    if (!VALID_ROUND_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid round status" },
        { status: 400 }
      );
    }

    const { data: currentRound } = await supabase
      .from("rounds")
      .select("status")
      .eq("id", body.round_id)
      .single();

    if (!currentRound) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    const allowed = ALLOWED_ROUND_TRANSITIONS[currentRound.status as RoundStatus] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${currentRound.status}' to '${body.status}'` },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.status !== undefined) updates.status = body.status;
  if (body.deadline !== undefined) updates.deadline = body.deadline;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: round, error } = await supabase
    .from("rounds")
    .update(updates)
    .eq("id", body.round_id)
    .eq("competition_id", body.competition_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update round", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ round });
}

/**
 * DELETE /api/admin/rounds
 * Delete a draft round and all its events.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("round_id");
  const competitionId = searchParams.get("competition_id");

  if (!roundId || !competitionId) {
    return NextResponse.json(
      { error: "round_id and competition_id are required" },
      { status: 400 }
    );
  }

  const member = await verifyCompetitionAdmin(supabase, user.id, competitionId);
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Only draft rounds can be deleted
  const { data: round } = await supabase
    .from("rounds")
    .select("status")
    .eq("id", roundId)
    .eq("competition_id", competitionId)
    .single();

  if (!round) {
    return NextResponse.json(
      { error: "Round not found" },
      { status: 404 }
    );
  }

  if (round.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft rounds can be deleted" },
      { status: 409 }
    );
  }

  // CASCADE will handle events and event_prediction_types
  const { error } = await supabase
    .from("rounds")
    .delete()
    .eq("id", roundId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete round", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
