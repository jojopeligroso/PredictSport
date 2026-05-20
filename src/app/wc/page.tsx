import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

export default async function WorldCupLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Calculate countdown to June 11 2026
  const kickoff = new Date("2026-06-11T15:00:00Z");
  const now = new Date();
  const diffMs = kickoff.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return (
    <div className="flex flex-1 flex-col items-center px-4">
      {/* Hero */}
      <section className="flex w-full max-w-md flex-col items-center gap-6 pt-12 pb-10 text-center md:pt-20">
        <BrandMark className="h-16 w-auto md:h-24" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ps-text md:text-4xl">
            World Cup 2026
          </h1>
          <p className="mt-2 font-serif text-lg italic text-ps-text-sec">
            48 teams. Your call.
          </p>
        </div>

        {/* Countdown */}
        {daysUntil > 0 && (
          <div className="rounded-xl bg-ps-surface border border-ps-border px-6 py-4">
            <p className="font-mono text-3xl font-bold text-ps-amber">{daysUntil}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-ps-text-ter">
              days to kickoff
            </p>
          </div>
        )}

        {/* CTA */}
        {user ? (
          <Link
            href="/wc/picks"
            className="w-full max-w-xs rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.97]"
          >
            Make your picks
          </Link>
        ) : (
          <Link
            href="/wc/join"
            className="w-full max-w-xs rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.97]"
          >
            Join the game
          </Link>
        )}
      </section>

      {/* How it works */}
      <section className="w-full max-w-md border-t border-ps-border pt-8 pb-10">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          Four ways to play
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
            description="Pick every group and knockout result before kickoff. One wrong pick and you're dead."
          />
          <ClassificationCard
            title="KO Bracket"
            description="Bracket picks from R32 onwards. Opens after the group stage."
          />
        </div>
      </section>

      {/* Scoring summary */}
      <section className="w-full max-w-md border-t border-ps-border pt-8 pb-14">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          Scoring
        </h2>
        <div className="mt-6 space-y-3">
          <ScoringRow points={2} label="Correct match outcome" />
          <ScoringRow points={3} label="Exact score bonus" />
          <ScoringRow points={1} label="Correct advancing team (knockout)" />
        </div>
        <p className="mt-4 text-center text-xs text-ps-text-ter">
          Group matches: max 5pts. Knockout: max 6pts.
        </p>
      </section>
    </div>
  );
}

function ClassificationCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <h3 className="text-sm font-bold text-ps-text">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ps-text-sec">{description}</p>
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
