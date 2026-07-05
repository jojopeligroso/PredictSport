import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { applyLiveOverlay } from "@/lib/tournament/live-overlay";

export async function GET() {
  const supabase = createServiceClient();

  // Get the WC competition
  const { data: comp } = await supabase
    .from("competitions")
    .select("id, tournament_id")
    .eq("id", "1a4448e5-a178-45ab-b819-a0dfab370306")
    .single();

  if (!comp) return NextResponse.json({ error: "no comp" });

  // Get members
  const { data: members } = await supabase
    .from("competition_members")
    .select("user_id")
    .eq("competition_id", comp.id);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const pointsMap = new Map<string, number>();
  for (const uid of userIds) pointsMap.set(uid, 0);

  const result = await applyLiveOverlay(supabase, {
    userIds,
    pointsMap,
    tournamentId: comp.tournament_id,
    competitionId: comp.id,
    activeSportingStageId: null,
    isFormat: false,
  });

  return NextResponse.json({
    hasLiveEvents: result.hasLiveEvents,
    liveEventIds: result.liveEventIds,
    livePredictionsCount: result.livePredictions.length,
    predictionTypes: [...new Set(result.livePredictions.map(p => p.prediction_type))],
    samplePreds: result.livePredictions.slice(0, 3).map(p => ({
      user_id: p.user_id.slice(0, 8),
      type: p.prediction_type,
      data: p.prediction_data,
    })),
    userIdsCount: userIds.length,
  });
}
