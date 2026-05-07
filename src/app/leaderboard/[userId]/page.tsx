import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonDetail } from "./PersonDetail";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ competition?: string }>;
}

export default async function PersonDetailPage({ params, searchParams }: PageProps) {
  const { userId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase
    .from("users")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .single();

  if (!person) notFound();

  const { data: memberships } = await supabase
    .from("competition_members")
    .select("competition_id, callout_label, competitions(id, name)")
    .eq("user_id", userId);

  const targetCompId = sp.competition ?? memberships?.[0]?.competition_id;
  if (!targetCompId) notFound();

  const membership = (memberships ?? []).find((m) => m.competition_id === targetCompId);
  const compName = (membership?.competitions as unknown as { name: string } | null)?.name ?? "";

  const { data: viewerMember } = await supabase
    .from("competition_members")
    .select("user_id")
    .eq("competition_id", targetCompId)
    .eq("user_id", user.id)
    .single();

  if (!viewerMember) notFound();

  const [{ data: events }, { data: allMembers }] = await Promise.all([
    supabase
      .from("events")
      .select("id, event_name, sport, status, result_data, start_time")
      .eq("competition_id", targetCompId)
      .eq("status", "resulted"),
    supabase
      .from("competition_members")
      .select("user_id")
      .eq("competition_id", targetCompId),
  ]);

  const eventList = events ?? [];
  const eventIds = eventList.map((e) => e.id);
  const eventMap = new Map(
    eventList.map((e) => [
      e.id,
      { event_name: e.event_name, sport: e.sport, result_data: e.result_data, start_time: e.start_time },
    ])
  );

  let allPredictions: Array<{
    id: string;
    event_id: string;
    user_id: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
  }> = [];

  if (eventIds.length > 0) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("id, event_id, user_id, prediction_data, is_correct, is_partial, points_awarded")
      .in("event_id", eventIds);
    allPredictions = preds ?? [];
  }

  const userPreds = allPredictions
    .filter((p) => p.user_id === userId)
    .map((p) => {
      const ev = eventMap.get(p.event_id);
      return { ...p, _event: ev ?? null };
    })
    .filter((p) => p._event !== null);

  const totalPoints = userPreds.reduce((sum, p) => sum + p.points_awarded, 0);
  const correctCount = userPreds.filter((p) => p.is_correct === true).length;
  const accuracy = userPreds.length > 0 ? Math.round((correctCount / userPreds.length) * 100) : 0;

  const sorted = [...userPreds].sort(
    (a, b) =>
      new Date(b._event!.start_time).getTime() - new Date(a._event!.start_time).getTime()
  );

  let streak = 0;
  for (const p of sorted) {
    if (p.is_correct === true) streak++;
    else break;
  }

  const form = sorted.slice(0, 5).map((p) => {
    if (p.is_correct === true) return "W" as const;
    if (p.is_partial) return "P" as const;
    return "L" as const;
  });

  // Rank: count users with more points
  const pointsByUser = new Map<string, number>();
  for (const p of allPredictions) {
    pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + p.points_awarded);
  }
  let rank = 1;
  for (const m of allMembers ?? []) {
    if (m.user_id === userId) continue;
    const otherTotal = pointsByUser.get(m.user_id) ?? 0;
    if (otherTotal > totalPoints) rank++;
  }

  const formatPredValue = (data: Record<string, unknown>): string => {
    if (data?.selection && typeof data.selection === "string") return data.selection;
    if (data?.value !== undefined) return String(data.value);
    if (data?.winner && typeof data.winner === "string") return data.winner;
    return JSON.stringify(data);
  };

  const formatResultValue = (data: Record<string, unknown> | null): string => {
    if (!data) return "Pending";
    if (data?.winner && typeof data.winner === "string") return data.winner;
    if (data?.result && typeof data.result === "string") return data.result;
    if (data?.value !== undefined) return String(data.value);
    return JSON.stringify(data);
  };

  return (
    <PersonDetail
      person={{
        id: person.id,
        displayName: person.display_name,
        calloutLabel: membership?.callout_label ?? `${person.display_name} reckons...`,
      }}
      competitionName={compName}
      rank={rank}
      totalPoints={totalPoints}
      accuracy={accuracy}
      streak={streak}
      form={form}
      predictions={sorted.map((p) => ({
        id: p.id,
        eventName: p._event!.event_name,
        sport: p._event!.sport,
        pickValue: formatPredValue(p.prediction_data),
        resultValue: formatResultValue(p._event!.result_data as Record<string, unknown> | null),
        isCorrect: p.is_correct,
        isPartial: p.is_partial,
        pointsAwarded: p.points_awarded,
      }))}
    />
  );
}
