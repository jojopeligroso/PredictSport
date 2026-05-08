import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventList } from "./event-list";
import { CompetitionSelector } from "./competition-selector";
import JoinCompetitionCard from "./join-competition-card";
import type { Competition, Event, Prediction, EventPredictionType } from "@/types/database";

interface SearchParams {
  competition?: string;
}

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's competitions via competition_members
  const { data: memberships, error: membershipsError } = await supabase
    .from("competition_members")
    .select("competition_id, role, competitions(id, name, status)")
    .eq("user_id", user.id);

  if (membershipsError) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="font-light text-2xl uppercase tracking-[0.06em] text-ps-text">
          My Predictions
        </h1>
        <div className="mt-8 rounded-xl border border-ps-red bg-ps-red-soft p-6 text-ps-red">
          Failed to load competitions. Please try again later.
        </div>
      </div>
    );
  }

  // Extract competitions from the joined query
  const competitions: Competition[] = (memberships ?? [])
    .map((m) => {
      const comp = m.competitions as unknown as Competition | null;
      return comp;
    })
    .filter((c): c is Competition => c !== null);

  // No competitions
  if (competitions.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="font-light text-2xl uppercase tracking-[0.06em] text-ps-text">
          My Predictions
        </h1>
        <p className="mt-2 text-ps-text-sec">
          Submit your predictions before each event locks.
        </p>
        <div className="mt-8 rounded-xl border border-ps-border bg-ps-surface p-12 text-center">
          <p className="text-ps-text-sec">
            You haven&apos;t joined any competitions yet.
          </p>
          <p className="mt-2 text-sm text-ps-text-ter">
            Ask a friend for an invite link, or join a public competition to get
            started.
          </p>
        </div>
        <div className="mt-6">
          <JoinCompetitionCard />
        </div>
      </div>
    );
  }

  // Determine selected competition
  const selectedCompetitionId =
    params.competition ?? competitions[0]?.id ?? null;

  const selectedCompetition = competitions.find(
    (c) => c.id === selectedCompetitionId
  );

  if (!selectedCompetition) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="font-light text-2xl uppercase tracking-[0.06em] text-ps-text">
          My Predictions
        </h1>
        <CompetitionSelector
          competitions={competitions}
          selectedId={selectedCompetitionId}
        />
        <div className="mt-8 rounded-xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          Competition not found. Select a different one above.
        </div>
      </div>
    );
  }

  // Fetch events for the selected competition
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .eq("competition_id", selectedCompetition.id)
    .order("start_time", { ascending: true });

  if (eventsError) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="font-light text-2xl uppercase tracking-[0.06em] text-ps-text">
          My Predictions
        </h1>
        <CompetitionSelector
          competitions={competitions}
          selectedId={selectedCompetitionId}
        />
        <div className="mt-8 rounded-xl border border-ps-red bg-ps-red-soft p-6 text-ps-red">
          Failed to load events. Please try again later.
        </div>
      </div>
    );
  }

  const typedEvents = (events ?? []) as Event[];

  // Fetch the active round for round name in hero
  const { data: activeRound } = await supabase
    .from("rounds")
    .select("round_number, name")
    .eq("competition_id", selectedCompetition.id)
    .in("status", ["open", "locked"])
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch user's predictions and event_prediction_types for all events
  const eventIds = typedEvents.map((e) => e.id);
  let predictions: Prediction[] = [];
  let eventPredictionTypes: EventPredictionType[] = [];

  if (eventIds.length > 0) {
    const [predResult, eptResult] = await Promise.all([
      supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .in("event_id", eventIds),
      supabase
        .from("event_prediction_types")
        .select("*")
        .in("event_id", eventIds),
    ]);

    predictions = (predResult.data ?? []) as Prediction[];
    eventPredictionTypes = (eptResult.data ?? []) as EventPredictionType[];
  }

  // Merge predictions and prediction types into events
  const eventsWithPredictions = typedEvents.map((event) => ({
    ...event,
    predictions: predictions.filter((p) => p.event_id === event.id),
    event_prediction_types: eventPredictionTypes.filter(
      (ept) => ept.event_id === event.id
    ),
  }));

  return (
    <div>
      <CompetitionSelector
        competitions={competitions}
        selectedId={selectedCompetitionId}
      />

      <EventList
        events={eventsWithPredictions}
        competitionId={selectedCompetition.id}
        competitionName={selectedCompetition.name}
        roundNumber={activeRound?.round_number}
        roundName={activeRound?.name}
      />

      <div className="mx-auto max-w-4xl px-4 pb-8">
        <JoinCompetitionCard />
      </div>
    </div>
  );
}
