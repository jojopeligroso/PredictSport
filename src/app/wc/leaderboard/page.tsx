import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClassificationTabs } from "@/components/tournament/ClassificationTabs";

export const dynamic = "force-dynamic";

/**
 * /leaderboard — Classification tabs + standings for the World Cup game.
 */
export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/leaderboard");
  }

  // Find the WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, invite_code, max_entrants, min_entrants")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">No competition found</h1>
      </div>
    );
  }

  // Get user display name
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Get member count
  const { count: memberCount } = await supabase
    .from("competition_members")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competition.id);

  // Get classifications
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id, classification_key, name, classification_type, status")
    .eq("competition_id", competition.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-[480px] flex-col px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">Leaderboard</h1>
      <div className="mt-4 flex flex-1 flex-col">
        <ClassificationTabs
          classifications={classifications ?? []}
          competitionId={competition.id}
          currentUserId={user.id}
          inviteCode={competition.invite_code ?? null}
          kickoffIso="2026-06-11T15:00:00Z"
          memberCount={memberCount ?? 0}
          maxEntrants={competition.max_entrants ?? null}
          minEntrants={competition.min_entrants ?? null}
          currentDisplayName={profile?.display_name ?? "You"}
        />
      </div>
    </div>
  );
}
