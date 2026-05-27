import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { isJoinsClosed, WC_JOINS_CLOSE_AT } from "@/lib/wc/join-cutoff";

export const dynamic = "force-dynamic";

/**
 * /wc/join — Entry flow for World Cup prediction game.
 *
 * If not logged in → redirect to login.
 * If logged in + soft cutoff passed + not yet a member → render "Joins closed".
 * If logged in → auto-enroll in the WC competition → redirect onward.
 *
 * Accepts an optional `?next=` param so other WC pages (e.g. a pick window)
 * can route a non-member here for idempotent enrollment and get them back.
 * `next` is validated to an internal /wc path to avoid an open redirect.
 *
 * Soft cutoff per ADR 0014: joins close 72h after first MD1 kickoff. Existing
 * members always pass through, even after cutoff (re-visits should not be
 * gated). New visitors after the cutoff see a closed panel.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination =
    next && next.startsWith("/wc/") ? next : "/wc/picks";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/wc/join?next=${destination}`)}`);
  }

  // Find the active WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, joins_locked_at")
    .eq("product_mode", "world_cup_2026_shell")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="font-display text-3xl uppercase tracking-tight text-ps-text">Coming Soon</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          The World Cup 2026 prediction game is being set up. Check back soon.
        </p>
      </div>
    );
  }

  // Check if already enrolled as competition member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Soft cutoff: applies only to *new* joiners. Existing members pass through.
  // Both the constant deadline and the per-competition override column are
  // checked — either being true means joins are closed for this visit.
  const cutoffReachedByConstant = isJoinsClosed(new Date());
  const cutoffSetOnRow = Boolean(competition.joins_locked_at);
  if (!existing && (cutoffReachedByConstant || cutoffSetOnRow)) {
    return <JoinsClosedPanel closedAt={competition.joins_locked_at ?? WC_JOINS_CLOSE_AT} />;
  }

  if (!existing) {
    // Create competition membership
    await supabase
      .from("competition_members")
      .insert({
        competition_id: competition.id,
        user_id: user.id,
        role: "participant",
      });
  }

  // Enroll in all active classifications (idempotent — handles duplicates)
  await enrollEntrant(supabase, competition.id, user.id);

  redirect(destination);
}

function JoinsClosedPanel({ closedAt }: { closedAt: string }) {
  // Cheeky per design/DESIGN-RULES.md personality. No corporate apology tone.
  const closedDate = new Date(closedAt);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(closedDate);

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
        Joins closed
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight text-ps-text">
        You&apos;re a day late.
      </h1>
      <p className="mt-3 text-sm text-ps-text-sec">
        The door shut on <span className="font-semibold text-ps-text">{dateLabel}</span>,
        three days after the tournament kicked off. No new picks from this point — but
        you&apos;re very welcome to watch the carnage unfold.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/wc"
          className="block w-full max-w-[260px] rounded-xl bg-ps-text px-6 py-3.5 text-center text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-text/90"
        >
          Watch the leaderboard
        </Link>
        <Link
          href="/wc/results"
          className="text-xs text-ps-text-sec underline-offset-2 hover:text-ps-text hover:underline"
        >
          See the fixtures & results →
        </Link>
      </div>
    </div>
  );
}
