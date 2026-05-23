import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OracleDot } from "@/components/OracleDot";
import { UmpireLogo } from "@/components/UmpireLogo";
import { BubbleCall } from "@/components/BubbleCall";
import type { BracketSubmissionData } from "@/types/tournament";

export const dynamic = "force-dynamic";

interface BracketSnapshot {
  classificationId: string;
  classificationName: string;
  status: string;
  pct: number;
  label: string;
}

async function getBracketSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<BracketSnapshot | null> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();
  if (!competition) return null;

  const { data: cls } = await supabase
    .from("classifications")
    .select("id, name, status")
    .eq("competition_id", competition.id)
    .eq("classification_key", "full_bracket")
    .eq("status", "active")
    .maybeSingle();
  if (!cls) return null;

  const { data: submission } = await supabase
    .from("bracket_prediction_submissions")
    .select("status, bracket_data")
    .eq("competition_id", competition.id)
    .eq("classification_id", cls.id)
    .eq("user_id", userId)
    .neq("status", "superseded")
    .maybeSingle();

  // Group progress now comes from `predictions` (per the 2026-05-23 unified-
  // predictions amendment), not from `bracket_data.groupsV2`. Count winner
  // predictions on this competition's WC group events.
  const { count: groupPicksCount } = await supabase
    .from("predictions")
    .select("event_id, events!inner(competition_id, external_event_id)", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("prediction_type", "winner")
    .eq("events.competition_id", competition.id)
    .like("events.external_event_id", "wc2026-grp-%");

  const data = submission?.bracket_data as BracketSubmissionData | null;
  const progress = bracketProgress(data, groupPicksCount ?? 0);

  return {
    classificationId: cls.id,
    classificationName: cls.name,
    status: submission?.status ?? "not_started",
    pct: progress.pct,
    label: progress.label,
  };
}

function bracketProgress(
  data: BracketSubmissionData | null,
  groupPicksCount: number,
): { pct: number; label: string } {
  // A user with no bracket draft but with group picks via /picks should still
  // see partial progress — group state lives in `predictions`, not in the
  // (possibly missing) bracket_data blob.
  if (!data && groupPicksCount === 0) return { pct: 0, label: "Not started" };
  const groupDone = Math.min(72, groupPicksCount);
  const thirdsDone = (data?.bestThirdPicks ?? []).length === 8;
  const knockoutPicks = data?.knockoutPicks ?? {};
  const koSlots = [
    "r32_m1","r32_m2","r32_m3","r32_m4","r32_m5","r32_m6","r32_m7","r32_m8",
    "r32_m9","r32_m10","r32_m11","r32_m12","r32_m13","r32_m14","r32_m15","r32_m16",
    "r16_m1","r16_m2","r16_m3","r16_m4","r16_m5","r16_m6","r16_m7","r16_m8",
    "qf_m1","qf_m2","qf_m3","qf_m4",
    "sf_m1","sf_m2",
    "final",
  ];
  const koDone = koSlots.filter((s) => knockoutPicks[s]?.winner).length;
  const finalDone = Boolean(data?.champion) && Boolean(data?.thirdPlace);

  const total = 72 + 1 + koSlots.length + 1;
  const done = groupDone + (thirdsDone ? 1 : 0) + koDone + (finalDone ? 1 : 0);
  const pct = Math.min(100, Math.round((done / total) * 100));

  let label = "Groups in progress";
  if (groupDone === 72) label = "Best thirds";
  if (thirdsDone) label = "Round of 32";
  if (koDone >= 16) label = "Round of 16";
  if (koDone >= 24) label = "Quarter-finals";
  if (koDone >= 28) label = "Semi-finals";
  if (koDone >= 30) label = "Final";
  if (finalDone) label = "Ready to submit";

  return { pct, label };
}

export default async function WorldCupLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bracket = user ? await getBracketSnapshot(supabase, user.id) : null;

  // Countdown to June 11 2026
  const kickoff = new Date("2026-06-11T15:00:00Z");
  const now = new Date();
  const diffMs = kickoff.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return (
    <div className="flex flex-1 flex-col items-center px-4">
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

        {/* CTA — both routes go via /wc/join, which enrols the user
            (idempotent) before redirecting to /wc/picks. A logged-in
            user who never joined would otherwise hit a 403 on submit. */}
        <Link
          href="/wc/join"
          className="w-full max-w-xs rounded-xl px-6 py-4 text-center text-base font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, #d4af37, #b8941f)",
            color: "#0a0f0a",
          }}
        >
          {user ? "Make your picks" : "Join the game"}
        </Link>

        {bracket && (
          <BracketSnapshotCard snapshot={bracket} />
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

function BracketSnapshotCard({ snapshot }: { snapshot: BracketSnapshot }) {
  const isLocked = snapshot.status === "locked";
  const isReady = snapshot.pct === 100;
  const ctaLabel = isLocked
    ? "View your bracket"
    : isReady
      ? "Review & submit"
      : snapshot.pct === 0
        ? "Start your bracket"
        : "Continue your bracket";

  return (
    <Link
      href={`/wc/bracket/wizard?classificationId=${snapshot.classificationId}`}
      className="block w-full max-w-xs overflow-hidden rounded-xl border-2 border-ps-border bg-ps-surface p-4 text-left transition-all hover:border-ps-amber/40 hover:shadow-sm active:scale-[0.98]"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Your bracket
        </span>
        <span
          className={`font-mono text-[10px] font-bold ${
            isLocked
              ? "text-ps-green"
              : isReady
                ? "text-ps-amber"
                : "text-ps-text-sec"
          }`}
        >
          {isLocked ? "LOCKED" : `${snapshot.pct}%`}
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-ps-text">
        {snapshot.label}
      </p>
      {!isLocked && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ps-chip">
          <div
            className="h-full bg-ps-amber transition-all duration-300"
            style={{ width: `${snapshot.pct}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-ps-amber">
        {ctaLabel} →
      </p>
    </Link>
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
