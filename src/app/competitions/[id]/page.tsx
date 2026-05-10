import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetitionTabs } from "@/app/admin/components/CompetitionTabs";

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

  return (
    <div className="mx-auto max-w-[480px] md:max-w-3xl lg:max-w-4xl p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="font-display text-ps-text font-extrabold"
            style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: -0.5 }}
          >
            {competition.name}
          </h1>
        </div>
        {(userRole === "admin" || userRole === "co_admin") && (
          <span
            className="rounded-full bg-ps-amber-soft px-2.5 py-1 text-ps-amber-deep"
            style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" as const }}
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
      />
    </div>
  );
}
