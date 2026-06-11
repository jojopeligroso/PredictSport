import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCommunityPredictions } from "@/lib/community-predictions";
import { EventDetail } from "./EventDetail";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch event with competition info
  const { data: event } = await supabase
    .from("events")
    .select("*, competitions(id, name)")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role, callout_label, user_id")
    .eq("competition_id", event.competition_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) notFound();

  // Fetch event prediction types
  const { data: predictionTypes } = await supabase
    .from("event_prediction_types")
    .select("*")
    .eq("event_id", eventId);

  // Fetch user's predictions
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  // Fetch community predictions (RLS handles visibility based on pick_reveal_at)
  const communityPredictions = await getCommunityPredictions(supabase, eventId);

  // Fetch all members for the competition (for callout labels and post-lock display)
  const { data: members } = await supabase
    .from("competition_members")
    .select("user_id, callout_label, users(id, display_name)")
    .eq("competition_id", event.competition_id);

  // Fetch reactions for all predictions on this event
  const reactions: Record<string, Record<string, number>> = {};

  // Fetch all predictions for reaction lookup
  const { data: allPredictions } = await supabase
    .from("predictions")
    .select("id, user_id")
    .eq("event_id", eventId);

  if (allPredictions && allPredictions.length > 0) {
    const predIds = allPredictions.map((p) => p.id);
    const { data: reactionRows } = await supabase
      .from("prediction_reactions")
      .select("prediction_id, emoji")
      .in("prediction_id", predIds);

    // Group by prediction_id -> emoji -> count
    for (const r of reactionRows ?? []) {
      if (!reactions[r.prediction_id]) reactions[r.prediction_id] = {};
      reactions[r.prediction_id][r.emoji] =
        (reactions[r.prediction_id][r.emoji] || 0) + 1;
    }
  }

  // Determine if picks are revealed
  const now = new Date();
  const lockTime = new Date(event.lock_time);
  const isLocked = now >= lockTime || event.status !== "upcoming";
  const revealTime = event.pick_reveal_at
    ? new Date(event.pick_reveal_at)
    : new Date(lockTime.getTime() + 5 * 60_000);
  const picksRevealed = event.result_confirmed || now >= revealTime;

  return (
    <EventDetail
      event={event}
      competitionName={(event.competitions as { id: string; name: string })?.name ?? ""}
      predictionTypes={(predictionTypes ?? []) as import("@/types/database").EventPredictionType[]}
      userPredictions={(userPredictions ?? []) as import("@/types/database").Prediction[]}
      communityPredictions={communityPredictions}
      allPredictions={(allPredictions ?? []) as Array<{ id: string; user_id: string }>}
      members={(members ?? []).map((m) => ({
        user_id: m.user_id,
        display_name:
          (m.users as unknown as { display_name: string } | null)?.display_name || "Unknown",
        callout_label: m.callout_label,
      }))}
      reactions={reactions}
      isLocked={isLocked}
      picksRevealed={picksRevealed}
      currentUserId={user.id}
    />
  );
}
