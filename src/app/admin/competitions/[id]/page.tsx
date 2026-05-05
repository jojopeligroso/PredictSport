import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "../../components/CompetitionStatusBadge";
import { CompetitionTabs } from "../../components/CompetitionTabs";

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

  // Verify user is admin/co_admin of this competition
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .in("role", ["admin", "co_admin"])
    .single();

  if (!membership) {
    notFound();
  }

  // Fetch competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .single();

  if (!competition) {
    notFound();
  }

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

  // Fetch nominations with nominator info
  const { data: nominations } = await supabase
    .from("event_nominations")
    .select("*, nominator:users!event_nominations_nominated_by_fkey(display_name)")
    .eq("competition_id", id)
    .order("created_at", { ascending: false });

  // Fetch invite tokens
  const { data: inviteTokens } = await supabase
    .from("invite_tokens")
    .select("*")
    .eq("competition_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-3"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Admin
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {competition.name}
          </h1>
          <StatusBadge status={competition.status} type="competition" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
            {competition.type}
          </span>
        </div>

        {competition.description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {competition.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <CompetitionTabs
        competition={competition}
        events={eventsWithTypes}
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
      />
    </div>
  );
}
