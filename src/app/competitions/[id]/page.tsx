import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetitionTabs } from "@/app/admin/components/CompetitionTabs";
import { checkAndPublishExpiredPending } from "@/lib/reputation/auto-publish";
import type { MemberTag } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check user's membership (any role)
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  const userRole = membership.role as "admin" | "co_admin" | "participant";

  // Fetch competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .single();

  if (!competition) {
    notFound();
  }

  // Fetch rounds
  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("competition_id", id)
    .order("round_number", { ascending: true });

  // Fetch events and their prediction types
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("competition_id", id)
    .order("start_time", { ascending: true });

  // Fetch event_prediction_types for all events
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: eventPredictionTypes } = eventIds.length > 0
    ? await supabase
        .from("event_prediction_types")
        .select("*")
        .in("event_id", eventIds)
    : { data: [] };

  // Merge prediction types into events
  const eventsWithTypes = (events ?? []).map((e) => ({
    ...e,
    event_prediction_types: (eventPredictionTypes ?? []).filter(
      (ept: { event_id: string }) => ept.event_id === e.id
    ),
  }));

  // Fetch members with user info
  const { data: members } = await supabase
    .from("competition_members")
    .select("*, user:users(display_name, email)")
    .eq("competition_id", id);

  // Fetch nominations with nominator info (only for admins)
  const { data: nominations } = (userRole === "admin" || userRole === "co_admin")
    ? await supabase
        .from("event_nominations")
        .select("*, nominator:users!event_nominations_nominated_by_fkey(display_name)")
        .eq("competition_id", id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Fetch invite tokens (only for admins)
  const { data: inviteTokens } = (userRole === "admin" || userRole === "co_admin")
    ? await supabase
        .from("invite_tokens")
        .select("*")
        .eq("competition_id", id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Fetch member tags (pending + active) for admin tag preview
  let memberTags: MemberTag[] = [];
  if (userRole === "admin" || userRole === "co_admin") {
    const { data: tagsData } = await supabase
      .from("member_tags")
      .select("*")
      .eq("competition_id", id)
      .in("status", ["pending", "active"])
      .limit(500);

    memberTags = (tagsData ?? []) as MemberTag[];

    // Side effect: auto-publish any pending tags past the 6-hour preview window
    try {
      await checkAndPublishExpiredPending(id);
    } catch {
      // Non-critical — log happens inside the function
    }
  }

  // Check for tournament classifications
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id, classification_type, classification_key, name, status")
    .eq("competition_id", id);

  const hasClassifications = (classifications?.length ?? 0) > 0;
  const hasBracket = classifications?.some(
    (c: { classification_type: string }) => c.classification_type === "bracket_survivor"
  ) ?? false;

  // Build finalisation data for tournament competitions
  let finalisationData: {
    windows: { id: string; name: string; status: string; totalEvents: number; confirmedEvents: number }[];
    stages: { id: string; name: string; status: string; totalWindows: number; scoredWindows: number }[];
  } | undefined;

  if (hasClassifications) {
    const tournamentRounds = (rounds ?? []).filter(
      (r: { sporting_stage_id?: string | null }) => r.sporting_stage_id
    );
    const windowData = tournamentRounds.map((r) => {
      const roundEvents = (events ?? []).filter((e) => e.round_id === r.id);
      return {
        id: r.id,
        name: r.name ?? `Round ${r.round_number}`,
        status: r.status ?? "open",
        totalEvents: roundEvents.length,
        confirmedEvents: roundEvents.filter((e) => e.result_confirmed).length,
      };
    });

    // Fetch sporting stages if tournament_id exists
    const { data: stages } = competition.tournament_id
      ? await supabase
          .from("sporting_stages")
          .select("id, name, status")
          .eq("tournament_id", competition.tournament_id)
          .order("stage_order", { ascending: true })
      : { data: [] };

    const stageData = (stages ?? []).map((s: { id: string; name: string; status: string }) => {
      const stageWindows = tournamentRounds.filter(
        (r: { sporting_stage_id?: string | null }) => r.sporting_stage_id === s.id
      );
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        totalWindows: stageWindows.length,
        scoredWindows: stageWindows.filter((r) => r.status === "scored").length,
      };
    });

    finalisationData = { windows: windowData, stages: stageData };
  }

  return (
    <div className="mx-auto max-w-[480px] md:max-w-3xl lg:max-w-4xl p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="font-display text-ps-text font-extrabold text-page-title"
            style={{ lineHeight: 1.1, letterSpacing: -0.5 }}
          >
            {competition.name}
          </h1>
        </div>
        {(userRole === "admin" || userRole === "co_admin") && (
          <span
            className="rounded-full bg-ps-amber-soft px-2.5 py-1 text-ps-amber-deep text-micro"
            style={{ fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" as const }}
          >
            {userRole === "admin" ? "Admin" : "Co-Admin"}
          </span>
        )}
      </div>

      {/* Tabs */}
      <CompetitionTabs
        competition={competition}
        events={eventsWithTypes}
        rounds={rounds ?? []}
        memberTags={memberTags}
        members={
          (members ?? []).map((m) => ({
            ...m,
            user: m.user
              ? {
                  display_name: (m.user as unknown as { display_name: string }).display_name,
                  email: (m.user as unknown as { email: string }).email,
                }
              : undefined,
          }))
        }
        nominations={
          (nominations ?? []).map((n) => ({
            ...n,
            nominator: n.nominator
              ? {
                  display_name: (n.nominator as unknown as { display_name: string }).display_name,
                }
              : undefined,
          }))
        }
        inviteTokens={inviteTokens ?? []}
        currentUserId={user.id}
        userRole={userRole}
        hasClassifications={hasClassifications}
        hasBracket={hasBracket}
        classifications={(classifications ?? []).map((c) => ({
          id: c.id,
          classification_key: c.classification_key,
          name: c.name ?? c.classification_key,
          classification_type: c.classification_type,
          status: c.status ?? "active",
        }))}
        finalisationData={finalisationData}
      />
    </div>
  );
}
