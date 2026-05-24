import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OracleDot } from "@/components/OracleDot";
import { UmpireLogo } from "@/components/UmpireLogo";
import { BubbleCall } from "@/components/BubbleCall";
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

      {/* Hero */}
      <section className="flex w-full max-w-md flex-col items-center gap-5 pt-10 pb-8 text-center md:pt-16">
        {/* All 3 brand marks */}
        <div className="flex items-center gap-4">
          <OracleDot className="h-8 w-auto opacity-70" />
          <UmpireLogo className="h-10 w-auto opacity-70" flagColor="#006847" />
          <BubbleCall className="h-8 w-auto opacity-70" />
        </div>

        {/* Wordmark */}
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ps-text md:text-4xl">
            World Cup{" "}
            <span className="text-ps-amber">2026</span>
          </h1>
          <p className="mt-2 font-serif text-lg italic text-ps-text-sec">
            48 teams. Your call.
          </p>
          <p
            className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "#006847" }}
          >
            Viva Mexico
          </p>
        </div>

        {/* Countdown */}
        {daysUntil > 0 && (
          <div
            className="rounded-xl border border-ps-border bg-ps-surface px-6 py-4"
            style={{ borderBottom: "2px solid #006847" }}
          >
            <p className="font-mono text-3xl font-bold text-ps-amber">
              {daysUntil}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ps-text-ter">
              days to kickoff
            </p>
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
      </section>

      {/* Host cities */}
      <p className="text-[10px] font-medium tracking-widest text-ps-text-ter uppercase">
        Mexico City &middot; Guadalajara &middot; Monterrey
      </p>

      {/* Four ways to play */}
      <section className="w-full max-w-md border-t border-ps-border pt-8 pb-8 mt-6">
        <h2 className="text-center text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Five ways to play
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <ClassificationCard
            title="Overall"
            description="Every match, every point. Cumulative from start to finish."
          />
          <ClassificationCard
            title="Format"
            description="Prediction groups of 4. Bottom drops each stage."
          />
          <ClassificationCard
            title="Full Bracket"
            description="Pick every group and knockout result before kickoff."
          />
          <ClassificationCard
            title="KO Bracket"
            description="Bracket picks from R32. Opens after the group stage."
          />
          <ClassificationCard
            title="Stage Pick"
            description="Predict outcomes at a knockout stage. Lock before kickoff."
            span
          />
        </div>
      </section>

      {/* Scoring */}
      <section className="w-full max-w-md border-t border-ps-border pt-8 pb-14">
        <h2 className="text-center text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Scoring
        </h2>
        <div className="mt-6 space-y-3">
          <ScoringRow points={2} label="Correct match outcome" />
          <ScoringRow points={3} label="Exact score bonus" />
          <ScoringRow points={1} label="Correct advancing team (knockout)" />
        </div>
        <p className="mt-4 text-center text-[10px] text-ps-text-ter">
          Group matches: max 5pts &middot; Knockout: max 6pts
        </p>
      </section>
    </div>
  );
}

function ClassificationCard({
  title,
  description,
  span,
}: {
  title: string;
  description: string;
  span?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-ps-border bg-ps-surface p-4 transition-colors hover:border-ps-border-strong ${
        span ? "col-span-2" : ""
      }`}
    >
      <h3 className="text-sm font-bold text-ps-text">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ps-text-sec">
        {description}
      </p>
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

function ScoringRow({ points, label }: { points: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-ps-surface px-4 py-3">
      <span className="font-mono text-lg font-bold text-ps-amber">{points}</span>
      <span className="text-sm text-ps-text">{label}</span>
    </div>
  );
}
