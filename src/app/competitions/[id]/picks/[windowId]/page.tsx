import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * /competitions/[id]/picks/[windowId] — Prediction window picks page.
 * Shows all events in this window with the user's picks (read-only display).
 */
export default async function WindowPicksPage({
  params,
}: {
  params: Promise<{ id: string; windowId: string }>;
}) {
  const { id: competitionId, windowId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/competitions/${competitionId}/picks/${windowId}`);
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  // Get the round and verify it belongs to this competition
  const { data: round } = await supabase
    .from("rounds")
    .select("id, name, competition_id, status, sporting_stage_id")
    .eq("id", windowId)
    .eq("competition_id", competitionId)
    .single();

  if (!round) {
    notFound();
  }

  const isLocked = round.status === "locked" || round.status === "scored";

  // Get events in this window
  const { data: events } = await supabase
    .from("events")
    .select(`
      id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_data, result_confirmed,
      event_prediction_types (id, prediction_type, points, partial_points, config)
    `)
    .eq("round_id", windowId)
    .order("start_time", { ascending: true });

  // Get user's existing predictions for this window
  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  const { data: userPredictions } = eventIds.length > 0
    ? await supabase
        .from("predictions")
        .select("id, event_id, prediction_type, prediction_data, points_awarded, is_correct")
        .eq("user_id", user.id)
        .in("event_id", eventIds)
    : { data: [] };

  // Group predictions by event
  const predictionsByEvent = new Map<string, Array<{
    id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    points_awarded: number;
    is_correct: boolean | null;
  }>>();
  for (const p of userPredictions ?? []) {
    const existing = predictionsByEvent.get(p.event_id) ?? [];
    existing.push(p);
    predictionsByEvent.set(p.event_id, existing);
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <Link
        href={`/competitions/${competitionId}`}
        className="text-sm font-medium text-ps-text-sec hover:text-ps-text"
      >
        &larr; Back to competition
      </Link>

      <h1 className="mt-3 text-xl font-extrabold text-ps-text">{round.name}</h1>

      {isLocked && (
        <div className="mt-2 inline-block rounded-full bg-ps-amber/20 px-3 py-1 text-xs font-semibold text-ps-amber">
          {round.status === "scored" ? "Finalised" : "Locked"}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {(events ?? []).map((event: {
          id: string;
          event_name: string;
          sport: string;
          start_time: string;
          lock_time: string;
          status: string;
          result_data: Record<string, unknown> | null;
          result_confirmed: boolean;
          event_prediction_types: Array<{
            id: string;
            prediction_type: string;
            points: number;
            partial_points: number;
            config: Record<string, unknown> | null;
          }>;
        }) => {
          const eventPreds = predictionsByEvent.get(event.id) ?? [];
          const eventLocked = new Date(event.lock_time) <= new Date() || event.status !== "upcoming";
          const hasEventPreds = eventPreds.length > 0;

          return (
            <div
              key={event.id}
              className="rounded-xl border bg-ps-surface p-4"
              style={hasEventPreds ? { borderColor: 'var(--ps-amber)', borderWidth: '2px' } : { borderColor: 'var(--ps-border)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ps-text">{event.event_name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
                    {new Date(event.start_time).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {eventLocked && (
                  <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-sec">
                    {event.result_confirmed ? "Resulted" : "Locked"}
                  </span>
                )}
              </div>

              {/* Prediction types for this event */}
              <div className="mt-3 space-y-2">
                {event.event_prediction_types.map((ept) => {
                  const pred = eventPreds.find(
                    (p) => p.prediction_type === ept.prediction_type
                  );

                  return (
                    <div
                      key={ept.id}
                      className="flex items-center justify-between rounded-lg bg-ps-bg px-3 py-2"
                    >
                      <div>
                        <span className="text-xs font-semibold text-ps-text">
                          {formatPredictionType(ept.prediction_type)}
                        </span>
                        <span className="ml-2 font-mono text-xs text-ps-text-ter">
                          {ept.points}pts
                        </span>
                      </div>
                      <div className="text-right">
                        {pred ? (
                          <span
                            className={`text-sm font-semibold ${
                              pred.is_correct === true
                                ? "text-ps-green"
                                : pred.is_correct === false
                                  ? "text-ps-red"
                                  : "text-ps-text"
                            }`}
                          >
                            {formatPredictionValue(pred.prediction_type, pred.prediction_data)}
                            {pred.is_correct !== null && (
                              <span className="ml-1 font-mono text-xs">
                                ({pred.points_awarded}pts)
                              </span>
                            )}
                          </span>
                        ) : eventLocked ? (
                          <span className="text-xs text-ps-text-ter">No pick</span>
                        ) : (
                          <span className="text-xs font-medium text-ps-amber">Pick needed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {(!events || events.length === 0) && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            No fixtures scheduled for this window yet.
          </p>
        )}
      </div>
    </div>
  );
}

function formatPredictionType(type: string): string {
  const labels: Record<string, string> = {
    winner: "Match Outcome",
    exact_score: "Exact Score",
    head_to_head: "Advancing Team",
    yes_no: "Yes/No",
    over_under: "Over/Under",
    margin: "Margin",
    progression: "Progression",
    top_n: "Top N",
    final_standings: "Final Standings",
    handicap: "Handicap",
  };
  return labels[type] ?? type;
}

function formatPredictionValue(type: string, data: Record<string, unknown>): string {
  if (type === "winner" || type === "head_to_head") {
    return (data.winner as string) ?? (data.selection as string) ?? (data.value as string) ?? "-";
  }
  if (type === "exact_score") {
    const home = data.home_score ?? data.homeScore;
    const away = data.away_score ?? data.awayScore;
    if (home !== undefined && away !== undefined) return `${home}-${away}`;
    return (data.score as string) ?? "-";
  }
  return JSON.stringify(data);
}
