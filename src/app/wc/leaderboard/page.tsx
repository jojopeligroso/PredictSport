import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationTabs } from "@/components/tournament/ClassificationTabs";
import { InviteCodeBanner } from "@/components/InviteCodeBanner";
import { getServerT } from "@/lib/i18n/server";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";

export const dynamic = "force-dynamic";

/**
 * /leaderboard — Classification tabs + standings for the World Cup game.
 */
export default async function LeaderboardPage() {
  const t = await getServerT();
  const { competition, user } = await resolveWcCompetition();

  if (!user) {
    redirect("/login?next=/wc/leaderboard");
  }

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">{t('leaderboard.no_competition')}</h1>
      </div>
    );
  }

  const supabase = await createClient();

  // Get user display name
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Get member count + user's role
  const [{ count: memberCount }, { data: membership }] = await Promise.all([
    supabase
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competition.id),
    supabase
      .from("competition_members")
      .select("role")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isAdmin = membership?.role === "admin" || membership?.role === "co_admin";

  // Get classifications — exclude bracket types (accessed via More menu)
  const { data: classificationsRaw } = await supabase
    .from("classifications")
    .select("id, classification_key, name, classification_type, status")
    .eq("competition_id", competition.id)
    .order("created_at", { ascending: true });

  const classifications = (classificationsRaw ?? []).filter(
    (c) => c.classification_key !== "full_bracket" && c.classification_key !== "knockout_bracket"
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";
  const joinUrl = `${appUrl}/join`;

  const competitionFull = competition.max_entrants && (memberCount ?? 0) >= competition.max_entrants;
  const showInvite =
    competition.invite_code &&
    competition.status === "active" &&
    !competitionFull &&
    (!competition.entry_closes_at ||
      new Date() < new Date(competition.entry_closes_at));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-[480px] flex-col px-4 pt-6 pb-16">
      <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-ps-text">{t('leaderboard.heading')}</h1>
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
          currentDisplayName={profile?.display_name || t('common.you')}
        />
      </div>

      {/* Invite code banner — below table */}
      {showInvite && (
        <div className="mt-4">
          <InviteCodeBanner
            inviteCode={competition.invite_code!}
            competitionName={competition.name ?? "WC Predict"}
            joinUrl={joinUrl}
            memberCount={memberCount ?? 0}
          />
        </div>
      )}

      {/* Navigation CTAs */}
      <div className="mt-4 flex gap-3">
        <Link
          href="/wc/home"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-ps-text px-4 py-2.5 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          {t('leaderboard.home')}
        </Link>
        <Link
          href="/wc"
          className="flex-1 inline-flex items-center justify-center rounded-full bg-ps-amber px-4 py-2.5 text-sm font-bold text-ps-text transition-opacity hover:opacity-90"
        >
          {t('leaderboard.back_to_matches')}
        </Link>
      </div>
    </div>
  );
}
