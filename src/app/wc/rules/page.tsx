/**
 * /wc/rules — How the World Cup prediction game works.
 *
 * Server component. Everything visible at a glance — no collapsibles.
 * Join CTA shown for non-members.
 */
import Link from "next/link";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rules — FIFA World Cup 2026",
  description:
    "How the World Cup 2026 prediction game works. Pick winners, guess scores, climb the leaderboard.",
};

export default async function WcRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isMember = false;
  if (user) {
    const { data } = await supabase
      .from("competition_members")
      .select("competition_id, competitions!inner(product_mode)")
      .eq("user_id", user.id)
      .eq("competitions.product_mode", "world_cup_2026_shell")
      .limit(1);
    isMember = (data ?? []).length > 0;
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title="Rules"
        subtitle="Everything you need to know."
        backHref="/wc"
        backLabel="Back to World Cup"
        className="mb-8"
      />

      {/* How it works */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          How it works
        </h2>
        <ol className="mt-3 space-y-3">
          <Step n={1} title="Pick the winner">
            For every match, pick who wins (or a draw in the group stage).
          </Step>
          <Step n={2} title="Guess the exact score">
            Each match also has a score prediction. Get it right for big bonus
            points.
          </Step>
          <Step n={3} title="Climb the leaderboard">
            Points add up across the whole tournament. Highest total wins.
          </Step>
        </ol>
      </section>

      {/* Points */}
      <section className="mt-8">
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Points
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ps-border">
              <PointsRow label="Correct winner (or draw)" points="2" />
              <PointsRow label="Exact score bonus" points="+3" />
              <PointsRow label="Correct team advances (knockout)" points="1" />
            </tbody>
          </table>
          <div className="border-t border-ps-border px-4 py-2.5">
            <p className="text-xs text-ps-text-sec">
              Max per group match:{" "}
              <span className="font-mono font-bold text-ps-text">5 pts</span>.
              Max per knockout match:{" "}
              <span className="font-mono font-bold text-ps-text">6 pts</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Ways to win */}
      <section className="mt-8">
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Ways to win
        </h2>
        <ul className="mt-3 space-y-2">
          <ClassificationItem
            name="Overall"
            description="Total points across the entire tournament. Most points wins. Daily prediction windows lock 10 minutes before the first match of that day."
          />
          <ClassificationItem
            name="Format"
            description="Groups of 4. After each stage, bottom player is eliminated and groups are redrawn. Last one standing wins. Same daily lock rule applies — each day locks before its earliest kickoff."
          />
          <ClassificationItem
            name="Full Bracket"
            description="Before the tournament starts, predict every group finish and the entire knockout bracket. Locks at first whistle."
          />
          <ClassificationItem
            name="KO Bracket"
            description="After groups finish, predict every knockout match from the Round of 32 to the final."
          />
        </ul>
      </section>

      {/* Prediction windows */}
      <section className="mt-8">
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Daily prediction windows
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Each daily prediction window locks 10 minutes before the first match
          of that day. If several matches are played on the same day, the full
          day&rsquo;s predictions lock before the earliest kickoff.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          You can submit predictions for future days in advance.
          Outcome-only predictions are saved, but you still need to add exact
          scores to fully complete that day&rsquo;s predictions. Once a window
          is locked, predictions can no longer be changed.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Events inside the same tournament stage may lock on different days
          and at different times.
        </p>
      </section>

      {/* Tiebreakers */}
      <section className="mt-8">
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Tiebreakers
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Same points? We break it by: head-to-head goal difference, then
          head-to-head goals scored, then overall goal difference, then overall
          goals scored, then coin flip.
        </p>
      </section>

      {/* Join CTA */}
      {!isMember && (
        <div className="mt-10 rounded-xl border border-ps-border bg-ps-surface px-5 py-5 text-center">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            Ready to play?
          </h2>
          <p className="mt-1.5 text-xs text-ps-text-sec">
            Joins close 3 days after kickoff.
          </p>
          <Link
            href={user ? "/wc/join" : "/login?next=/wc/join"}
            className="mt-4 inline-block w-full rounded-xl bg-ps-text px-4 py-3 text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-text/90"
          >
            {user ? "Join now" : "Sign in to join"}
          </Link>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-amber font-mono text-xs font-bold text-ps-bg">
        {n}
      </span>
      <div className="-mt-0.5">
        <p className="text-sm font-semibold text-ps-text">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
          {children}
        </p>
      </div>
    </li>
  );
}

function PointsRow({ label, points }: { label: string; points: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-sm text-ps-text">{label}</td>
      <td className="px-4 py-2.5 text-right font-mono font-bold text-ps-amber">
        {points}
      </td>
    </tr>
  );
}

function ClassificationItem({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <li className="rounded-lg bg-ps-chip px-3.5 py-2.5">
      <p className="text-sm font-semibold text-ps-text">{name}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
        {description}
      </p>
    </li>
  );
}
