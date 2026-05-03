import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventList } from "./event-list";
import { CompetitionSelector } from "./competition-selector";
import type { Competition, Event, Prediction } from "@/types/database";

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
    redirect("/auth/login");
  }

  // Fetch user's competitions via competition_members
  const { data: memberships, error: membershipsError } = await supabase
    .from("competition_members")
    .select("competition_id, role, competitions(id, name, status)")
    .eq("user_id", user.id);

  if (membershipsError) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My Predictions
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My Predictions
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Submit your predictions before each event locks.
        </p>
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            You haven&apos;t joined any competitions yet.
          </p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            Ask a friend for an invite link, or join a public competition to get
            started.
          </p>
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My Predictions
        </h1>
        <CompetitionSelector
          competitions={competitions}
          selectedId={selectedCompetitionId}
        />
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My Predictions
        </h1>
        <CompetitionSelector
          competitions={competitions}
          selectedId={selectedCompetitionId}
        />
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Failed to load events. Please try again later.
        </div>
      </div>
    );
  }

  const typedEvents = (events ?? []) as Event[];

  // Fetch user's predictions for all events in this competition
  const eventIds = typedEvents.map((e) => e.id);
  let predictions: Prediction[] = [];

  if (eventIds.length > 0) {
    const { data: predData } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user.id)
      .in("event_id", eventIds);

    predictions = (predData ?? []) as Prediction[];
  }

  // Merge predictions into events
  const eventsWithPredictions = typedEvents.map((event) => ({
    ...event,
    predictions: predictions.filter((p) => p.event_id === event.id),
  }));

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        My Predictions
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Submit your predictions before each event locks.
      </p>

      <CompetitionSelector
        competitions={competitions}
        selectedId={selectedCompetitionId}
      />

      <EventList
        events={eventsWithPredictions}
        competitionId={selectedCompetition.id}
      />
    </div>
  );
}
