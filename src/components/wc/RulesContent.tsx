"use client";

/**
 * RulesContent — single-scroll rules page for /wc/rules.
 * Sticky pill nav tracks sections: Points, Format, Picks, Ties.
 * Contextual floating dots appear for Format sub-sections.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StickyPillNav } from "./StickyPillNav";
import { FormatProgressDots } from "./FormatProgressDots";

interface RulesContentProps {
  isMember: boolean;
  isAuthenticated: boolean;
  firstLockTime: string | null;
}

export function RulesContent({
  isMember,
  isAuthenticated,
  firstLockTime,
}: RulesContentProps) {
  return (
    <>
      <StickyPillNav />
      <FormatProgressDots />

      {/* Intro */}
      <p className="mb-10 font-serif text-sm italic leading-relaxed text-ps-text-sec">
        A prediction game built as an homage to the World Cup&rsquo;s own format
        &mdash; groups, knockouts, and a final.
      </p>

      {/* How it works */}
      <div className="mb-10 rounded-xl border border-ps-border bg-ps-surface px-5 py-5 text-center">
        <p className="font-mono text-[15px] uppercase tracking-[0.18em] text-ps-amber-deep">
          How it works
        </p>
        <div className="mx-auto mt-3 flex w-fit flex-col gap-3">
          <HowItWorksStep n={1}>Pick the winner of each match</HowItWorksStep>
          <HowItWorksStep n={2}>
            Guess the exact score for bonus points
          </HowItWorksStep>
          <HowItWorksStep n={3}>Climb the leaderboard</HowItWorksStep>
        </div>
      </div>

      {/* ── POINTS ───────────────────────────────────────────── */}
      <CollapsibleSection id="points" title="Points Scoring System">
        <PointsTable />

        <h2 className="mt-6 font-display text-base font-extrabold text-ps-text">
          Ways to win
        </h2>
        <ul className="mt-3 space-y-2">
          <ClassificationCard
            name="Format"
            description="Survivor-style elimination that mirrors the World Cup itself. Groups, knockouts, last one standing. See the Format section below for the full breakdown."
          />
          <ClassificationCard
            name="Overall"
            description="Total points across the whole tournament. Every correct pick counts. Most points wins."
          />
          <li>
            <details className="group/more">
              <summary className="flex cursor-pointer items-center gap-1.5 list-none text-xs font-semibold text-ps-text-sec [&::-webkit-details-marker]:hidden">
                <span>More ways to win</span>
                <svg
                  className="h-3.5 w-3.5 shrink-0 transition-transform group-open/more:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <ul className="mt-2 space-y-2">
                <ClassificationCard
                  name="KO Bracket"
                  description="Once groups are done, predict every knockout match from the Round of 32 to the Final."
                />
                <ClassificationCard
                  name="Full Bracket"
                  description="Before kickoff, predict every group finish and the entire knockout bracket. Locks at first whistle."
                />
              </ul>
            </details>
          </li>
        </ul>
      </CollapsibleSection>

      {/* ── FORMAT ───────────────────────────────────────────── */}
      <CollapsibleSection id="format" title="Format — Survivor">
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
          With 48 players, the elimination curve mirrors the World Cup itself.
          With fewer players, the curve is adjusted to keep every round
          competitive.
        </p>

        {/* ── Group Stage ── */}
        <div id="format-groups" className="mt-6">
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

          {/* Group A card */}
          <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
            <div className="border-b border-ps-border px-4 py-2.5">
              <p className="text-sm font-bold text-ps-text">Group A</p>
              <p className="font-mono text-[10px] text-ps-text-ter">
                1 of 12 groups &middot; 48 players
              </p>
            </div>
            {/* Row 1 — Manning */}
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
                You
              </span>
              <span className="mr-2 rounded bg-ps-green/15 px-1.5 py-0.5 text-[10px] font-bold text-ps-green">
                SAFE
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                11 pts
              </span>
            </div>
            {/* DANGER ZONE banner */}
            <div className="border-l-[3px] border-l-ps-amber bg-ps-amber/[0.15] px-4 py-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-amber">
                Danger Zone
              </p>
              <p className="mt-0.5 text-[10px] text-ps-text-sec">
                Only the best 3rd-place finishers survive
              </p>
            </div>
            {/* Row 3 — Bohanna (AT RISK) */}
            <div className="flex items-center border-b border-ps-border border-l-[2px] border-l-ps-amber/50 bg-ps-amber/[0.12] px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                3
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Bohanna</span>
              <span className="mr-2 rounded bg-ps-amber/25 px-2 py-0.5 text-[10px] font-bold text-ps-amber">
                AT RISK
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                7 pts
              </span>
            </div>
            {/* ELIMINATED banner */}
            <div className="border-l-[3px] border-l-ps-red bg-ps-red/[0.08] px-4 py-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-red">
                Eliminated
              </p>
              <p className="mt-0.5 text-[10px] text-ps-text-sec">
                4th place is always cut
              </p>
            </div>
            {/* Row 4 — Scrooch (OUT) */}
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
            <p className="text-sm font-semibold text-ps-text">
              How the cut works
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ps-text-sec">
              <li>
                <span className="font-semibold text-ps-green">Top 2</span> in
                each group qualify automatically.
              </li>
              <li className="-mx-1.5 rounded-md bg-ps-amber/[0.08] px-2.5 py-2 text-[13px]">
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

        {/* ── Knockout Rounds ── */}
        <div id="format-knockouts" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            Knockout Rounds
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            Points reset. New groups drawn from survivors. Bottom half
            eliminated. Repeat until only the finalists remain.
          </p>

          {/* R32 card */}
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
                You
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
                {Array.from({ length: 15 }, (_, i) => (
                  <span
                    key={i}
                    className="select-none text-[10px] text-ps-text-ter/30 blur-[3px]"
                  >
                    ██████
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ps-text-sec">
            Points reset to zero. Only this round counts for survival.
          </p>
        </div>

        {/* ── Final ── */}
        <div id="format-final" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            Final
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            The last 2 survivors predict both the Third-Place Play-Off and the
            Final. Most points wins. No elimination &mdash; just a winner.
          </p>
        </div>

        {/* ── How the field narrows ── */}
        <div id="format-narrowing" className="mt-6">
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
                <EliminationRow values={[48, 32, 16, 8, 4, 2, 1]} highlighted />
                <EliminationRow values={[24, 16, 8, 4, 3, 2, 1]} />
                <EliminationRow values={[16, 11, 6, 4, 3, 2, 1]} />
                <EliminationRow values={[12, 8, 5, 4, 3, 2, 1]} />
                <EliminationRow values={[8, 6, 5, 4, 3, 2, 1]} />
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── PICKS ────────────────────────────────────────────── */}
      <CollapsibleSection id="picks" title="When do picks lock?">
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
      </CollapsibleSection>

      {/* ── TIES ─────────────────────────────────────────────── */}
      <CollapsibleSection id="ties" title="Tiebreakers">
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          Same points?{" "}
          <strong className="text-ps-text">H2H goal diff</strong> &rarr;{" "}
          <strong className="text-ps-text">H2H goals</strong> &rarr;{" "}
          <strong className="text-ps-text">overall goal diff</strong> &rarr;{" "}
          <strong className="text-ps-text">overall goals</strong> &rarr;{" "}
          <strong className="text-ps-text">coin flip</strong>
        </p>
      </CollapsibleSection>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <CollapsibleSection id="faq" title="FAQ" defaultOpen>
        <div className="mt-3 space-y-2">
          <FAQGroup title="Basics">
            <FAQ q="Do I have to predict every match?">
              No. You can skip any match. But every correct pick earns points, so
              the more you predict the better your chances on the leaderboard.
            </FAQ>
            <FAQ q="Is the exact score required?">
              No &mdash; it&rsquo;s optional. Pick the winner (or draw) first.
              If you also nail the exact score you earn a +3 bonus on top.
            </FAQ>
            <FAQ q="Can I change my picks?">
              Yes, as many times as you like before the day locks. Once a
              matchday locks (10 min before the first kickoff that day), all
              picks for that day are final.
            </FAQ>
            <FAQ q="When can I join?">
              You can join any time before the entry deadline (3 days after
              kickoff). Late joiners can still pick unlocked matches but
              auto-forfeit anything already locked.
            </FAQ>
          </FAQGroup>
          <FAQGroup title="Scoring &amp; Classifications">
            <FAQ q="How many points can I earn per match?">
              Group stage: up to 5 pts (2 for correct outcome + 3 exact score
              bonus). Knockout: up to 6 pts (2 outcome + 3 score + 1 for
              correct advancing team).
            </FAQ>
            <FAQ q="What are the different leaderboard classifications?">
              <strong>Overall</strong> &mdash; cumulative points across all
              matches. <strong>Format</strong> &mdash; survivor elimination that
              mirrors the World Cup structure. <strong>Full Bracket</strong> &amp;{" "}
              <strong>KO Bracket</strong> &mdash; pre-tournament bracket
              predictions scored after groups / knockouts complete.
            </FAQ>
            <FAQ q="What does &ldquo;Draw&rdquo; mean in a knockout match?">
              It means the scores are level after extra time &mdash; the match
              is decided by penalties. You pick who advances separately. Your
              result prediction is the score after extra time, excluding
              penalties.
            </FAQ>
            <FAQ q="How does the extra knockout point work?">
              In knockout matches you also predict which team advances. This is
              worth 1 bonus point on top of the result and score picks. It
              matters most when the match is a draw &mdash; you can still earn
              a point by correctly picking who goes through on penalties.
            </FAQ>
          </FAQGroup>
          <FAQGroup title="Rules &amp; Tiebreakers">
            <FAQ q="How are ties on the leaderboard broken?">
              Head-to-head goal difference &rarr; head-to-head goals &rarr;
              overall goal difference &rarr; overall goals &rarr; coin flip.
            </FAQ>
            <FAQ q="What happens if a match is postponed?">
              Your picks stay valid. The match moves to its new time and your
              predictions carry over. If a match is cancelled, affected picks
              are voided (no points gained or lost).
            </FAQ>
          </FAQGroup>
          <FAQGroup title="Technical">
            <FAQ q="Do my picks auto-save?">
              Yes. Winner picks save instantly on tap. Score predictions save
              after 1.75 seconds of inactivity or when you tap away.
            </FAQ>
            <FAQ q="Can I play on desktop?">
              Yes &mdash; the app works on any device with a browser. It&rsquo;s
              designed mobile-first but fully functional on desktop.
            </FAQ>
          </FAQGroup>
        </div>
      </CollapsibleSection>

      {/* ── CTA ──────────────────────────────────────────────── */}
      {!isMember && (
        <JoinCta
          isAuthenticated={isAuthenticated}
          firstLockTime={firstLockTime}
        />
      )}
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================

function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details id={id} open={defaultOpen || undefined} className="group mb-10">
      <summary className="flex cursor-pointer items-center justify-between list-none [&::-webkit-details-marker]:hidden">
        <h2 className="font-display text-base font-extrabold text-ps-text">
          {title}
        </h2>
        <svg
          className="h-5 w-5 shrink-0 text-ps-text-sec transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      {children}
    </details>
  );
}

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
          <span className="font-mono font-bold text-ps-text">5 pts</span>. Max
          per knockout match:{" "}
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

function EliminationRow({
  values,
  highlighted,
}: {
  values: number[];
  highlighted?: boolean;
}) {
  return (
    <tr className={highlighted ? "bg-ps-amber/5" : ""}>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-2 py-2 font-mono ${
            i === 0
              ? `px-3 text-left font-bold ${highlighted ? "text-ps-amber" : "text-ps-text-sec"}`
              : `text-center ${highlighted ? "text-ps-text" : "text-ps-text-sec"}`
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

function JoinCta({
  isAuthenticated,
  firstLockTime,
}: {
  isAuthenticated: boolean;
  firstLockTime: string | null;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface px-5 py-5 text-center">
      <h2 className="font-display text-lg font-extrabold text-ps-text">
        Ready to play?
      </h2>
      <div className="mt-1.5">
        {firstLockTime ? (
          <LockCountdown lockTime={firstLockTime} />
        ) : (
          <p className="text-xs text-ps-text-sec">
            Joins close 3 days after kickoff.
          </p>
        )}
      </div>
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

function FAQGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-text-ter">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-ps-border bg-ps-surface px-3.5 py-2.5">
      <summary className="cursor-pointer text-sm font-semibold text-ps-text marker:text-ps-amber">
        {q}
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
        {children}
      </p>
    </details>
  );
}

function LockCountdown({ lockTime }: { lockTime: string }) {
  const [display, setDisplay] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      const diff = new Date(lockTime).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(
        `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lockTime]);

  if (display === null) {
    return (
      <p className="text-xs text-ps-text-sec">
        Joins close 3 days after kickoff.
      </p>
    );
  }

  return (
    <p className="text-xs text-ps-text-sec">
      Picks lock in{" "}
      <span className="font-mono font-bold text-ps-text">{display}</span>
    </p>
  );
}
