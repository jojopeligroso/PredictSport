import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OracleDot } from "@/components/OracleDot";
import {
  getWcBracketSnapshot,
  type BracketSnapshot,
} from "@/lib/tournament/bracket-snapshot";

export const dynamic = "force-dynamic";

// Ink-on-poster card surface. The hero PNG paints the whole page behind these
// cards as a fixed CSS background (see the wrapper below). All colors here are
// intentionally literal so the surface stays dark even if a future `wc-theme`
// light variant flips the ps-* tokens to cream.
const CARD_BASE =
  "rounded-2xl border border-white/10 p-5 text-[#fefdf7] " +
  "shadow-[0_20px_44px_-18px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] " +
  "backdrop-blur-[5.6px] backdrop-saturate-[1.05]";

// Warm amber bloom in the top-left corner of each card, fading into deep ink.
const CARD_BG: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 80% at 0% 0%, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0) 55%), " +
    "linear-gradient(160deg, rgba(28,22,16,0.80) 0%, rgba(8,8,8,0.84) 100%)",
};

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
    // The whole landing surface is a dark canvas with the FIFA hero painted
    // across it as a fixed CSS background. The cards float on top. Scoped to
    // this wrapper only — the `/wc/*` layout (nav, wc-theme) is untouched.
    <div
      className="-mt-[1px] min-h-screen bg-[#0a0a0a]"
      style={{
        backgroundImage: "url('/wc/hero-fifa-2026.png')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
        backgroundSize: "145% auto",
        backgroundAttachment: "fixed",
        backgroundColor: "#0a0a0a",
      }}
    >
      <main className="mx-auto flex max-w-[480px] flex-col gap-6 px-4 pt-[35px] pb-[39px]">

        {/* Card 1 — wordmark + tagline + hook + countdown */}
        <section className={CARD_BASE} style={CARD_BG}>
          <div className="text-center">
            <h1 className="font-display text-[32px] leading-none uppercase tracking-tight">
              World Cup <span className="text-ps-amber">2026</span>
            </h1>
            <p className="mt-2 font-serif text-lg italic text-white/70">
              48 teams. 104 matches. 1 winner. Your call.
            </p>
          </div>

          <p className="mt-5 text-center font-display text-xl font-extrabold leading-snug">
            Predict every match. Survive the cut. Outlast everyone. Win.
          </p>

          {daysUntil > 0 && (
            <div className="mt-5 flex justify-center">
              <div
                className="rounded-[10px] border border-white/10 bg-white/[0.06] px-[22px] py-3 text-center font-mono"
                style={{ borderBottom: "2px solid #4ade80" }}
              >
                <p className="text-[26px] font-extrabold leading-none text-ps-amber">
                  {daysUntil}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.20em] text-white/55">
                  days to kickoff
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Card 2 — Four narrative beats */}
        <section className={CARD_BASE} style={CARD_BG}>
          <NarrativeBeat
            title="Predict every match."
            body="Winner and exact score across all 104 fixtures. Group stage through the final."
          />
          <NarrativeBeat
            title="Survive the cut."
            body="Prediction groups of four. Bottom drops after each stage. Miss the cut and you’re out."
          />
          <NarrativeBeat
            title="Outlast everyone."
            body="Overall points. Bracket picks. Multiple ways to win — or claw your way back."
            dashed
          />
          <NarrativeBeat
            title="Win."
            body="Top of the table when the dust settles. Bragging rights included."
            accent
            last
          />
        </section>

        {/* Card 3 — Primary CTA, state-driven, with rules link */}
        <section className={CARD_BASE} style={CARD_BG}>
          {user && bracket && !bracketDone ? (
            <div className="flex flex-col items-center gap-4">
              <Link
                href={`/wc/bracket/wizard?classificationId=${bracket.classificationId}`}
                className="block w-full max-w-[320px] rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #d4af37, #b8941f)",
                  color: "#0a0f0a",
                  boxShadow:
                    "0 8px 22px -8px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                {bracket.copy.dashboardPrimaryCta}
              </Link>
              <BracketProgressMeter snapshot={bracket} />
              <Link
                href={picksHref}
                className="text-sm font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
              >
                Or skip ahead to matchday picks →
              </Link>
            </div>
          ) : user && bracketDone && bracket ? (
            <div className="flex flex-col items-center gap-4">
              <Link
                href={picksHref}
                className="block w-full max-w-[320px] rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #d4af37, #b8941f)",
                  color: "#0a0f0a",
                  boxShadow:
                    "0 8px 22px -8px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                Make your picks
              </Link>
              <Link
                href={`/wc/bracket/wizard?classificationId=${bracket.classificationId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  {bracket.stage === "locked" ? "Locked" : "Submitted"}
                </span>
                {bracket.copy.dashboardSecondaryCta} →
              </Link>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link
                href={picksHref}
                className="block w-full max-w-[320px] rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #d4af37, #b8941f)",
                  color: "#0a0f0a",
                  boxShadow:
                    "0 8px 22px -8px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                {user ? "Make your picks" : "Join the game"}
              </Link>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <Link
              href="/wc/rules"
              className="text-xs text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
            >
              Simple scoring. Full rules →
            </Link>
          </div>
        </section>

        {/* Brand sign-off — Oracle Dot at the very end, small + compact */}
        <footer className="flex justify-center pt-5 pb-2 opacity-60">
          <OracleDot className="h-9 w-auto" />
        </footer>

      </main>
    </div>
  );
}

function NarrativeBeat({
  title,
  body,
  dashed,
  accent,
  last,
}: {
  title: string;
  body: string;
  dashed?: boolean;
  accent?: boolean;
  last?: boolean;
}) {
  // Each beat sits between two border rules; the dashed variant lets two
  // adjacent beats bleed into each other (Outlast → Win on master). The first
  // beat skips the top border so it doesn't double up with the card edge.
  return (
    <div
      className={[
        "py-5",
        dashed
          ? "border-t border-dashed border-white/15"
          : "border-t border-white/15",
        last ? "pb-0" : "",
        "first:border-t-0 first:pt-0",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2
        className={`font-display font-extrabold ${
          accent ? "text-2xl text-ps-amber" : "text-lg text-[#fefdf7]"
        }`}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-white/70">{body}</p>
    </div>
  );
}

function BracketProgressMeter({ snapshot }: { snapshot: BracketSnapshot }) {
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/55">
          {snapshot.label}
        </span>
        <span className="font-mono text-[10px] font-bold text-white/70">
          {snapshot.pct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-ps-amber transition-all duration-300"
          style={{ width: `${snapshot.pct}%` }}
        />
      </div>
    </div>
  );
}
