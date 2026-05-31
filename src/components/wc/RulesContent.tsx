"use client";

/**
 * RulesContent — client component for /wc/rules.
 * Receives isMember and isAuthenticated from the server component.
 * Renders Overview / Deep Dive tabs.
 */

import { useState } from "react";
import Link from "next/link";

interface RulesContentProps {
  isMember: boolean;
  isAuthenticated: boolean;
}

export function RulesContent({ isMember, isAuthenticated }: RulesContentProps) {
  const [tab, setTab] = useState<"overview" | "deep-dive">("overview");

  return (
    <>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-ps-bg p-1">
        <button
          onClick={() => setTab("overview")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "overview"
              ? "bg-ps-surface text-ps-text shadow-sm"
              : "text-ps-text-sec hover:text-ps-text"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("deep-dive")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "deep-dive"
              ? "bg-ps-surface text-ps-text shadow-sm"
              : "text-ps-text-sec hover:text-ps-text"
          }`}
        >
          Deep Dive
        </button>
      </div>

      {tab === "overview" ? (
        <OverviewTab isMember={isMember} isAuthenticated={isAuthenticated} />
      ) : (
        <DeepDiveTab isMember={isMember} isAuthenticated={isAuthenticated} />
      )}
    </>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({
  isMember,
  isAuthenticated,
}: {
  isMember: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <p className="font-serif text-sm italic leading-relaxed text-ps-text-sec">
        A prediction game built as an homage to the World Cup&rsquo;s own format
        &mdash; groups, knockouts, and a final.
      </p>

      {/* How it works */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ps-amber-deep">
          How it works
        </p>
        <div className="mt-3 flex flex-col items-center gap-3">
          <HowItWorksStep n={1}>Pick the winner of each match</HowItWorksStep>
          <HowItWorksStep n={2}>Guess the exact score for bonus points</HowItWorksStep>
          <HowItWorksStep n={3}>Climb the leaderboard</HowItWorksStep>
        </div>
      </section>

      {/* Points */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">Points</h2>
        <PointsTable />
      </section>

      {/* Ways to win */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Ways to win
        </h2>
        <ul className="mt-3 space-y-2">
          <ClassificationCard
            name="Overall"
            description="Total points across the whole tournament. Every correct pick counts. Most points wins."
          />
          <ClassificationCard
            name="Format"
            description="Survivor-style elimination that mirrors the World Cup itself. Groups, knockouts, last one standing. See the Deep Dive for the full breakdown."
          />
          <ClassificationCard
            name="Full Bracket"
            description="Before kickoff, predict every group finish and the entire knockout bracket. Locks at first whistle."
          />
          <ClassificationCard
            name="KO Bracket"
            description="Once groups are done, predict every knockout match from the Round of 32 to the Final."
          />
        </ul>
      </section>

      {/* Predictions */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Your picks
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Each day&rsquo;s matches lock 10 minutes before the first kickoff of
          that day. Changed your mind? No problem &mdash; update your picks as
          many times as you like before the day locks.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          You can submit picks for future days in advance.
        </p>
      </section>

      {/* Join CTA */}
      {!isMember && <JoinCta isAuthenticated={isAuthenticated} />}
    </div>
  );
}

// ============================================================
// Deep Dive Tab
// ============================================================

function DeepDiveTab({
  isMember,
  isAuthenticated,
}: {
  isMember: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <div className="space-y-10">
      {/* Format — Survivor */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Format &mdash; Survivor
        </h2>
        <p className="mt-1 font-serif text-sm italic text-ps-text-sec">
          Last one standing.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ps-text-sec">
          The Format classification is an homage to the World Cup&rsquo;s own
          structure. You&rsquo;re placed in a group. After each stage is
          finalised, the bottom players are eliminated and the survivors are
          redrawn into new groups. Points reset to zero at each stage &mdash;
          only your current performance matters.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          With 48 players, the elimination curve mirrors the World Cup itself:
          a third cut after groups, then halved at each knockout round. With
          fewer players, the curve is adjusted to keep every round competitive.
        </p>

        {/* Group Stage */}
        <div className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            Group Stage (Matchdays 1&ndash;3)
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            All three matchdays count as one stage. Your points accumulate
            across MD1, MD2, and MD3.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            After MD3, the cut works like the real World Cup:
          </p>

          {/* Group A illustration */}
          <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
            <div className="border-b border-ps-border px-4 py-2.5">
              <p className="text-sm font-bold text-ps-text">Group A</p>
              <p className="font-mono text-[10px] text-ps-text-ter">
                1 of 12 groups &middot; 48 players
              </p>
            </div>
            {/* Row 1 */}
            <div className="flex items-center border-b border-ps-border px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                1
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Manning</span>
              <span className="mr-2 rounded bg-ps-green/15 px-1.5 py-0.5 text-[10px] font-bold text-ps-green">
                SAFE
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                14 pts
              </span>
            </div>
            {/* Row 2 — You */}
            <div className="flex items-center border-b border-ps-border bg-ps-amber/5 px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                2
              </span>
              <span className="flex-1 pl-2 text-sm font-semibold text-ps-text">
                You{" "}
                <span className="ml-1 rounded bg-ps-amber/20 px-1 py-0.5 text-[10px] font-bold text-ps-amber">
                  YOU
                </span>
              </span>
              <span className="mr-2 rounded bg-ps-green/15 px-1.5 py-0.5 text-[10px] font-bold text-ps-green">
                SAFE
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                11 pts
              </span>
            </div>
            {/* Amber dashed divider */}
            <div className="border-t border-dashed border-ps-amber/50" />
            {/* Row 3 — Danger zone */}
            <div className="flex items-center border-b border-ps-border bg-ps-amber/[0.08] px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                3
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Bohanna</span>
              <span className="mr-2 rounded bg-ps-amber/20 px-1.5 py-0.5 text-[10px] font-bold text-ps-amber">
                ?
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                7 pts
              </span>
            </div>
            {/* Red dashed divider */}
            <div className="border-t border-dashed border-ps-red/50" />
            {/* Row 4 — Eliminated */}
            <div className="flex items-center bg-ps-red/5 px-4 py-2.5 opacity-50">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                4
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Scrooch</span>
              <span className="mr-2 rounded bg-ps-red/15 px-1.5 py-0.5 text-[10px] font-bold text-ps-red">
                OUT
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                3 pts
              </span>
            </div>
          </div>

          {/* How the cut works */}
          <div className="mt-3 rounded-lg bg-ps-chip px-3.5 py-3">
            <p className="text-sm font-semibold text-ps-text">How the cut works</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ps-text-sec">
              <li>
                <span className="font-semibold text-ps-green">Top 2</span> in
                each group qualify automatically.
              </li>
              <li>
                <span className="font-semibold text-ps-amber">3rd place</span>{" "}
                is the danger zone. Your points are compared against every other
                3rd-place finisher across all groups. Only the best thirds
                survive &mdash; the rest are eliminated. With 48 players: 8 of
                12 thirds qualify. The other 4 go home.
              </li>
              <li>
                <span className="font-semibold text-ps-red">4th place</span> is
                always eliminated.
              </li>
            </ul>
          </div>
        </div>

        {/* Knockout Rounds */}
        <div className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            Knockout Rounds
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            Points reset. New groups drawn from survivors. Bottom half
            eliminated. Repeat until only the finalists remain.
          </p>

          {/* R32 illustration */}
          <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
            <div className="border-b border-ps-border px-4 py-2.5">
              <p className="text-sm font-bold text-ps-text">Round of 32</p>
              <p className="font-mono text-[10px] text-ps-text-ter">
                32 survive &middot; points reset &middot; new groups drawn
              </p>
            </div>
            <div className="flex items-center border-b border-ps-border px-4 py-2">
              <span className="w-6 text-center font-mono text-xs text-ps-text-ter">
                1
              </span>
              <span className="flex-1 select-none pl-2 text-xs text-ps-text-ter blur-[5px]">
                ████████████
              </span>
              <span className="w-14 text-right font-mono text-xs text-ps-text-ter">
                &mdash;
              </span>
            </div>
            <div className="flex items-center border-b border-ps-border px-4 py-2">
              <span className="w-6 text-center font-mono text-xs text-ps-text-ter">
                2
              </span>
              <span className="flex-1 select-none pl-2 text-xs text-ps-text-ter blur-[5px]">
                ██████████
              </span>
              <span className="w-14 text-right font-mono text-xs text-ps-text-ter">
                &mdash;
              </span>
            </div>
            <div className="border-b border-ps-border px-4 py-1 text-center font-mono text-[10px] text-ps-text-ter">
              &middot; &middot; &middot;
            </div>
            {/* You at rank 14 */}
            <div className="flex items-center border-b border-ps-border bg-ps-amber/5 px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                14
              </span>
              <span className="flex-1 pl-2 text-sm font-semibold text-ps-text">
                You{" "}
                <span className="ml-1 rounded bg-ps-amber/20 px-1 py-0.5 text-[10px] font-bold text-ps-amber">
                  YOU
                </span>
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                &mdash;
              </span>
            </div>
            <div className="border-b border-ps-border px-4 py-1 text-center font-mono text-[10px] text-ps-text-ter">
              &middot; &middot; &middot;
            </div>
            <div className="flex items-center border-b border-ps-border px-4 py-2">
              <span className="w-6 text-center font-mono text-xs text-ps-text-ter">
                32
              </span>
              <span className="flex-1 select-none pl-2 text-xs text-ps-text-ter blur-[5px]">
                ████████████
              </span>
              <span className="w-14 text-right font-mono text-xs text-ps-text-ter">
                &mdash;
              </span>
            </div>
            {/* Eliminated section */}
            <div className="bg-ps-red/[0.03] px-4 py-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-red/60">
                16 eliminated
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[10px] text-ps-text-ter/40 line-through">
                  Scrooch
                </span>
                {[
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                  "██████",
                ].map((n, i) => (
                  <span
                    key={i}
                    className="select-none text-[10px] text-ps-text-ter/30 blur-[3px]"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ps-text-sec">
            Points reset to zero. Only this round counts for survival.
          </p>
        </div>

        {/* Final */}
        <div className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            Final
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            The last 2 survivors predict both the Third-Place Play-Off and the
            Final. Most points wins. No elimination &mdash; just a winner.
          </p>
        </div>

        {/* Elimination Curves */}
        <div className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            How the field narrows
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            With 48 players, the elimination curve mirrors the World Cup itself.
            With fewer players, adjustments are made for competitive integrity
            &mdash; ensuring at least one elimination at every stage.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ps-border">
                  <th className="px-3 py-2 text-left font-mono font-bold text-ps-text-ter">
                    Start
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    Grps
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    R32
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    R16
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    QF
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    SF
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    W
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ps-border">
                <tr className="bg-ps-amber/5">
                  <td className="px-3 py-2 font-mono font-bold text-ps-amber">
                    48
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    32
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    16
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    8
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    4
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    2
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text">
                    1
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-bold text-ps-text-sec">
                    24
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    16
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    8
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    4
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    3
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    2
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    1
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-bold text-ps-text-sec">
                    16
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    11
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    6
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    4
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    3
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    2
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    1
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-bold text-ps-text-sec">
                    12
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    8
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    5
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    4
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    3
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    2
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    1
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-bold text-ps-text-sec">
                    8
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    6
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    5
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    4
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    3
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    2
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ps-text-sec">
                    1
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detailed Points */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">Points</h2>
        <PointsTable />
      </section>

      {/* Daily Prediction Windows */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          When do picks lock?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Each day&rsquo;s matches lock 10 minutes before the first kickoff of
          that day. You can submit picks for future days in advance &mdash; but
          once a day locks, it&rsquo;s locked.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Changed your mind? No problem &mdash; update your picks as many times
          as you like before the day locks.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-ps-amber-deep">
            More detail
          </summary>
          <div className="mt-2 text-xs leading-relaxed text-ps-text-sec">
            <p>
              Outcome-only predictions are saved, but you still need to add
              exact scores to fully complete that day&rsquo;s predictions.
            </p>
            <p className="mt-1.5">
              Events inside the same tournament stage may lock on different days
              and at different times.
            </p>
          </div>
        </details>
      </section>

      {/* Tiebreakers */}
      <section>
        <h2 className="font-display text-base font-extrabold text-ps-text">
          Tiebreakers
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Same points?{" "}
          <strong className="text-ps-text">H2H goal diff</strong>
          {" "}&rarr;{" "}
          <strong className="text-ps-text">H2H goals</strong>
          {" "}&rarr;{" "}
          <strong className="text-ps-text">overall goal diff</strong>
          {" "}&rarr;{" "}
          <strong className="text-ps-text">overall goals</strong>
          {" "}&rarr;{" "}
          <strong className="text-ps-text">coin flip</strong>
        </p>
      </section>

      {/* Join CTA */}
      {!isMember && <JoinCta isAuthenticated={isAuthenticated} />}
    </div>
  );
}

// ============================================================
// Shared sub-components
// ============================================================

function HowItWorksStep({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-amber font-mono text-xs font-bold text-ps-bg">
        {n}
      </span>
      <span className="text-sm text-ps-text">{children}</span>
    </div>
  );
}

function PointsTable() {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-ps-border">
          <PointsRow label="Correct winner (or draw)" points="2" />
          <PointsRow label="Exact score bonus" points="+3" />
          <PointsRow label="Correct team advances (KO)" points="1" />
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

function ClassificationCard({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <li className="rounded-lg bg-ps-chip px-3.5 py-2.5">
      <p className="text-sm font-bold text-ps-text">{name}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
        {description}
      </p>
    </li>
  );
}

function JoinCta({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface px-5 py-5 text-center">
      <h2 className="font-display text-lg font-extrabold text-ps-text">
        Ready to play?
      </h2>
      <p className="mt-1.5 text-xs text-ps-text-sec">
        Joins close 3 days after kickoff.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={isAuthenticated ? "/wc/join" : "/login?next=/wc/join"}
          className="inline-block w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-amber/90"
        >
          Join with a code
        </Link>
        <Link
          href={isAuthenticated ? "/wc/create" : "/login?next=/wc/create"}
          className="inline-block w-full rounded-xl border border-ps-border px-4 py-3 text-sm font-semibold text-ps-text transition-colors hover:bg-ps-surface"
        >
          Create your own
        </Link>
      </div>
    </div>
  );
}
