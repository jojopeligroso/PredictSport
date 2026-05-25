import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getWcBracketSnapshot,
  type BracketSnapshot,
} from "@/lib/tournament/bracket-snapshot";

export const dynamic = "force-dynamic";

export default async function WorldCupLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bracket = user ? await getWcBracketSnapshot(supabase, user.id) : null;

  // Members skip the /wc/join hop on "Make your picks" — they're already
  // enrolled, sending them through join just adds a redirect.
  let isMember = false;
  if (user) {
    const { data: competition } = await supabase
      .from("competitions")
      .select("id")
      .eq("product_mode", "world_cup_2026_shell")
      .in("status", ["active", "draft"])
      .limit(1)
      .maybeSingle();
    if (competition) {
      const { data: membership } = await supabase
        .from("competition_members")
        .select("id")
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .maybeSingle();
      isMember = Boolean(membership);
    }
  }
  const picksHref = isMember ? "/wc/picks" : "/wc/join";
  // "Done" = user has at least submitted the bracket. Both `submitted`
  // (editable until lock) and `locked` (sealed) demote the bracket to a
  // secondary CTA — only the in-progress / ready-to-submit / not-started
  // states keep the bracket as the hero action.
  const bracketDone =
    bracket?.stage === "submitted" || bracket?.stage === "locked";

  // Countdown to June 11 2026
  const kickoff = new Date("2026-06-11T15:00:00Z");
  const now = new Date();
  const diffMs = kickoff.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return (
    <div className="flex flex-1 flex-col items-center px-4">
      {/* Full-bleed hero banner — negative margin breaks out of the page's px-4 */}
      <div className="-mx-4 w-screen max-w-none">
        <Image
          src="/wc/hero-fifa-2026.png"
          alt="FIFA World Cup 2026"
          width={1024}
          height={577}
          priority
          sizes="100vw"
          className="h-auto w-full"
        />
      </div>

      {/* Title block */}
      <section className="flex w-full max-w-md flex-col items-center gap-5 pt-10 pb-4 text-center md:pt-16">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ps-text md:text-4xl">
            World Cup{" "}
            <span className="text-ps-amber">2026</span>
          </h1>
          <p className="mt-2 font-serif text-lg italic text-ps-text-sec">
            48 teams. Your call.
          </p>
        </div>

        {/* Hook tagline */}
        <p className="font-display text-xl font-extrabold leading-snug text-ps-text md:text-2xl">
          Predict every match. Survive the cut. Outlast everyone. Win.
        </p>
      </section>

      {/* Narrative beats — four-beat arc mirroring the hook */}
      <section className="w-full max-w-md pb-8">
        {/* Pick */}
        <div className="border-t border-ps-border py-6">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            Predict every match.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ps-text-sec">
            Winner and exact score across all 104 fixtures. Group stage through
            the final.
          </p>
        </div>

        {/* Survive + Outlast bleed into each other — no hard visual break between them */}
        <div className="border-t border-ps-border py-6">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            Survive the cut.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ps-text-sec">
            Prediction groups of four. Bottom drops after each stage. Miss the
            cut and you&apos;re out.
          </p>
        </div>

        <div className="border-t border-dashed border-ps-border py-6">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            Outlast everyone.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ps-text-sec">
            Overall points. Bracket picks. Multiple ways to win — or claw your
            way back.
          </p>
        </div>

        {/* Claim */}
        <div className="border-t border-ps-border py-6">
          <h2 className="font-display text-2xl font-extrabold text-ps-amber">
            Win.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ps-text-sec">
            Top of the table when the dust settles. Bragging rights included.
          </p>
        </div>
      </section>

      {/* Countdown — pre-tournament only */}
      {daysUntil > 0 && (
        <div className="mb-8">
          <div className="rounded-xl border border-ps-border bg-ps-surface px-6 py-4 text-center">
            <p className="font-mono text-3xl font-bold text-ps-amber">
              {daysUntil}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ps-text-ter">
              days to kickoff
            </p>
          </div>
        </div>
      )}

      {/* Primary CTA, in priority order:
       *
       * 1. Bracket not yet submitted (not_started / in_progress /
       *    ready_to_submit) — bracket IS the primary action. Tiebreakers
       *    and best-thirds-ranking can only be captured there, and users
       *    who don't finish the bracket have skipped the onboarding
       *    contract. "Skip ahead to matchday picks" stays visible as a
       *    demoted escape hatch.
       * 2. Bracket submitted OR locked — bracket is done (sealed or
       *    editable-until-lock); matchday picks become the hero. The
       *    secondary "Review / View your bracket" button stays visible
       *    (not hidden) but is clearly subordinate. Submitted gets
       *    "Review" so users know they can still revise; locked gets
       *    "View".
       * 3. Signed-out / no bracket snapshot — "Join the game" → /wc/join,
       *    the idempotent enrolment door.
       */}
      <section className="flex w-full max-w-md flex-col items-center gap-4 pb-8">
        {user && bracket && !bracketDone ? (
          <>
            <Link
              href={`/wc/bracket/wizard?classificationId=${bracket.classificationId}`}
              className="w-full max-w-xs rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #d4af37, #b8941f)",
                color: "#0a0f0a",
              }}
            >
              {bracket.copy.dashboardPrimaryCta}
            </Link>
            <BracketProgressMeter snapshot={bracket} />
            <Link
              href={picksHref}
              className="text-sm font-semibold text-ps-text-sec underline-offset-2 hover:text-ps-text hover:underline"
            >
              Or skip ahead to matchday picks →
            </Link>
          </>
        ) : user && bracketDone && bracket ? (
          <>
            <Link
              href={picksHref}
              className="w-full max-w-xs rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #d4af37, #b8941f)",
                color: "#0a0f0a",
              }}
            >
              Make your picks
            </Link>
            <Link
              href={`/wc/bracket/wizard?classificationId=${bracket.classificationId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ps-border bg-ps-surface px-4 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:border-ps-green/40 hover:text-ps-text"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-green">
                {bracket.stage === "locked" ? "Locked" : "Submitted"}
              </span>
              {bracket.copy.dashboardSecondaryCta} →
            </Link>
          </>
        ) : (
          <>
            <Link
              href={picksHref}
              className="w-full max-w-xs rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #d4af37, #b8941f)",
                color: "#0a0f0a",
              }}
            >
              {user ? "Make your picks" : "Join the game"}
            </Link>
          </>
        )}

        {/* Rules link — secondary, below the CTA */}
        <Link
          href="/wc/rules"
          className="text-xs text-ps-text-ter underline-offset-2 hover:text-ps-text-sec hover:underline"
        >
          Simple scoring. Full rules →
        </Link>
      </section>

    </div>
  );
}

function BracketProgressMeter({ snapshot }: { snapshot: BracketSnapshot }) {
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          {snapshot.label}
        </span>
        <span className="font-mono text-[10px] font-bold text-ps-text-sec">
          {snapshot.pct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ps-chip">
        <div
          className="h-full bg-ps-amber transition-all duration-300"
          style={{ width: `${snapshot.pct}%` }}
        />
      </div>
    </div>
  );
}
