"use client";

/**
 * RulesContent — single-scroll rules page for /wc/rules.
 * Sticky pill nav tracks sections: Points, Format, Picks, Ties, FAQs.
 * Contextual floating dots appear for Format sub-sections.
 */

import { StickyPillNav } from "./StickyPillNav";
import { FormatProgressDots } from "./FormatProgressDots";
import { WcJoinCard } from "./WcJoinCard";
import { useT } from "@/lib/i18n";

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
  const t = useT();

  return (
    <>
      <StickyPillNav />
      <FormatProgressDots />

      {/* Intro */}
      <p className="mb-10 font-serif text-sm italic leading-relaxed text-ps-text-sec">
        {t("rules.intro")}
      </p>

      {/* How it works */}
      <div className="mb-10 rounded-xl border border-ps-border bg-ps-surface px-5 py-5 text-center">
        <p className="font-display font-extrabold text-item-label uppercase tracking-[0.18em] text-ps-amber-deep">
          {t("rules.how_it_works")}
        </p>
        <div className="mx-auto mt-3 flex w-fit flex-col gap-3">
          <HowItWorksStep n={1}>{t("rules.step1")}</HowItWorksStep>
          <HowItWorksStep n={2}>{t("rules.step2")}</HowItWorksStep>
          <HowItWorksStep n={3}>{t("rules.step3")}</HowItWorksStep>
        </div>
      </div>

      {/* ── POINTS ───────────────────────────────────────────── */}
      <CollapsibleSection id="points" title={t("rules.points_title")} defaultOpen>
        <PointsTable />
      </CollapsibleSection>

      {/* ── WAYS TO WIN ─────────────────────────────────────── */}
      <CollapsibleSection id="ways-to-win" title={t("rules.ways_to_win")}>
        <ul className="mt-3 space-y-2">
          <ClassificationCard
            name={t("create.class_format")}
            description={t("create.class_format_desc")}
          />
          <ClassificationCard
            name={t("create.class_overall")}
            description={t("create.class_overall_desc")}
          />
          <li>
            <details className="group/more">
              <summary className="flex cursor-pointer items-center gap-1.5 list-none text-xs font-semibold text-ps-text-sec [&::-webkit-details-marker]:hidden">
                <span>{t("rules.more_ways")}</span>
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
                  name={t("create.class_ko_bracket")}
                  description={t("create.class_ko_bracket_desc")}
                />
                <ClassificationCard
                  name={t("create.class_bracket")}
                  description={t("create.class_bracket_desc")}
                />
              </ul>
            </details>
          </li>
        </ul>
      </CollapsibleSection>

      {/* ── FORMAT ───────────────────────────────────────────── */}
      <CollapsibleSection id="format" title={t("rules.format_title")} defaultOpen>
        <p className="mt-1 font-serif text-sm italic text-ps-text-sec">
          {t("rules.format_tagline")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ps-text-sec">
          {t("rules.format_desc_1")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          {t("rules.format_desc_2")}
        </p>

        {/* ── Group Stage ── */}
        <div id="format-groups" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            {t("rules.group_stage_heading")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.group_stage_desc_1")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.group_stage_desc_2")}
          </p>

          {/* Group A card */}
          <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
            <div className="border-b border-ps-border px-4 py-2.5">
              <p className="text-sm font-bold text-ps-text">Group A</p>
              <p className="font-mono text-micro text-ps-text-ter">
                1 of 12 groups &middot; 48 players
              </p>
            </div>
            {/* Row 1 — Manning */}
            <div className="flex items-center border-b border-ps-border px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                1
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Manning</span>
              <span className="mr-2 rounded bg-ps-green/15 px-1.5 py-0.5 text-micro font-bold text-ps-green">
                {t("rules.safe")}
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                14 pts
              </span>
            </div>
            {/* Row 2 — Scrooch (YOU) */}
            <div className="flex items-center border-b border-ps-border bg-ps-amber/5 px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                2
              </span>
              <span className="flex-1 pl-2 text-sm font-semibold text-ps-text">
                Scrooch
                <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                  {t("common.you")}
                </span>
              </span>
              <span className="mr-2 rounded bg-ps-green/15 px-1.5 py-0.5 text-micro font-bold text-ps-green">
                {t("rules.safe")}
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                11 pts
              </span>
            </div>
            {/* DANGER ZONE banner */}
            <div className="border-l-[3px] border-l-ps-amber bg-ps-amber/[0.15] px-4 py-2">
              <p className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-amber">
                {t("rules.danger_zone")}
              </p>
              <p className="mt-0.5 text-micro text-ps-text-sec">
                {t("rules.danger_desc")}
              </p>
            </div>
            {/* Row 3 — Bohanna (AT RISK) */}
            <div className="flex items-center border-b border-ps-border border-l-[2px] border-l-ps-amber/50 bg-ps-amber/[0.12] px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                3
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Bohanna</span>
              <span className="mr-2 rounded bg-ps-amber/25 px-2 py-0.5 text-micro font-bold text-ps-amber">
                {t("rules.at_risk")}
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                7 pts
              </span>
            </div>
            {/* ELIMINATED banner */}
            <div className="border-l-[3px] border-l-ps-red bg-ps-red/[0.08] px-4 py-2">
              <p className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-red">
                {t("rules.eliminated")}
              </p>
              <p className="mt-0.5 text-micro text-ps-text-sec">
                {t("rules.eliminated_desc")}
              </p>
            </div>
            {/* Row 4 — Gerry Ramos (OUT) */}
            <div className="flex items-center bg-ps-red/5 px-4 py-2.5 opacity-50">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                4
              </span>
              <span className="flex-1 pl-2 text-sm text-ps-text">Gerry Ramos</span>
              <span className="mr-2 rounded bg-ps-red/15 px-1.5 py-0.5 text-micro font-bold text-ps-red">
                {t("rules.out")}
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                3 pts
              </span>
            </div>
          </div>

          {/* How the cut works */}
          <div className="mt-3 rounded-lg bg-ps-chip px-3.5 py-3">
            <p className="text-sm font-semibold text-ps-text">
              {t("rules.how_cut_works")}
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ps-text-sec">
              <li>{t("rules.top2")}</li>
              <li className="-mx-1.5 rounded-md bg-ps-amber/[0.08] px-2.5 py-2 text-body">
                {t("rules.third_place")}
              </li>
              <li>{t("rules.fourth_place")}</li>
            </ul>
          </div>

          {/* Group sizing rule */}
          <p className="mt-3 text-xs leading-relaxed text-ps-text-ter">
            {t("group.sizing_rule")}
          </p>
        </div>

        {/* ── Knockout Rounds ── */}
        <div id="format-knockouts" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            {t("rules.knockout_heading")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.knockout_desc")}
          </p>

          {/* R32 card */}
          <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
            <div className="border-b border-ps-border px-4 py-2.5">
              <p className="text-sm font-bold text-ps-text">Round of 32</p>
              <p className="font-mono text-micro text-ps-text-ter">
                {t("rules.r32_meta")}
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
            <div className="border-b border-ps-border px-4 py-1 text-center font-mono text-micro text-ps-text-ter">
              &middot; &middot; &middot;
            </div>
            {/* Scrooch (YOU) at rank 14 */}
            <div className="flex items-center border-b border-ps-border bg-ps-amber/5 px-4 py-2.5">
              <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                14
              </span>
              <span className="flex-1 pl-2 text-sm font-semibold text-ps-text">
                Scrooch
                <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                  {t("common.you")}
                </span>
              </span>
              <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                &mdash;
              </span>
            </div>
            <div className="border-b border-ps-border px-4 py-1 text-center font-mono text-micro text-ps-text-ter">
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
              <p className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-red/60">
                {t("rules.eliminated_count", { count: 16 })}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-micro text-ps-text-ter/40 line-through">
                  Gerry Ramos
                </span>
                {Array.from({ length: 15 }, (_, i) => (
                  <span
                    key={i}
                    className="select-none text-micro text-ps-text-ter/30 blur-[3px]"
                  >
                    ██████
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.knockout_note")}
          </p>
        </div>

        {/* ── Final ── */}
        <div id="format-final" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            {t("rules.final_heading")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.final_desc")}
          </p>
        </div>

        {/* ── How the field narrows ── */}
        <div id="format-narrowing" className="mt-6">
          <h3 className="font-display text-sm font-extrabold text-ps-text">
            {t("rules.narrowing_heading")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
            {t("rules.narrowing_desc")}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ps-border">
                  <th className="px-3 py-2 text-left font-mono font-bold text-ps-text-ter">
                    {t("rules.table_start")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_grps")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_r32")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_r16")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_qf")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_sf")}
                  </th>
                  <th className="px-2 py-2 text-center font-mono font-bold text-ps-text-ter">
                    {t("rules.table_w")}
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
      <CollapsibleSection id="picks" title={t("locks.title")}>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          {t("locks.desc_1")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ps-text-sec">
          {t("locks.desc_2")}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-ps-amber-deep">
            {t("locks.more_detail")}
          </summary>
          <div className="mt-2 text-xs leading-relaxed text-ps-text-sec">
            <p>{t("locks.detail_1")}</p>
            <p className="mt-1.5">{t("locks.detail_2")}</p>
          </div>
        </details>
      </CollapsibleSection>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <CollapsibleSection id="faq" title={t("faq.title")} defaultOpen>
        <div className="mt-3 space-y-2">
          <FAQGroup title={t("faq.group_basics")} defaultOpen>
            <FAQ q={t("faq.q_every_match")}>
              {t("faq.a_every_match")}
            </FAQ>
            <FAQ q={t("faq.q_exact_required")}>
              {t("faq.a_exact_required")}
            </FAQ>
            <FAQ q={t("faq.q_change_picks")}>
              {t("faq.a_change_picks")}
            </FAQ>
            <FAQ q={t("faq.q_when_join")}>
              {t("faq.a_when_join")}
            </FAQ>
          </FAQGroup>
          <FAQGroup title={t("faq.group_scoring")}>
            <FAQ q={t("faq.q_points_per_match")}>
              {t("faq.a_points_per_match")}
            </FAQ>
            <FAQ q={t("faq.q_classifications")}>
              {t("faq.a_classifications")}
            </FAQ>
            <FAQ q={t("faq.q_draw_knockout")}>
              {t("faq.a_draw_knockout")}
            </FAQ>
            <FAQ q={t("faq.q_extra_ko_point")}>
              {t("faq.a_extra_ko_point")}
            </FAQ>
          </FAQGroup>
          <FAQGroup title={t("faq.group_rules")}>
            <FAQ q={t("faq.q_postponed")}>
              {t("faq.a_postponed")}
            </FAQ>
          </FAQGroup>
          <FAQGroup title={t("faq.group_technical")}>
            <FAQ q={t("faq.q_auto_save")}>
              {t("faq.a_auto_save")}
            </FAQ>
            <FAQ q={t("faq.q_desktop")}>
              {t("faq.a_desktop")}
            </FAQ>
          </FAQGroup>
        </div>
      </CollapsibleSection>

      {/* ── CTA ──────────────────────────────────────────────── */}
      {!isMember && (
        <WcJoinCard
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
  const t = useT();

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-ps-border">
          <PointsRow label={t("rules.correct_winner")} points="2" />
          <PointsRow label={t("rules.exact_score_bonus")} points="+3" />
          <PointsRow label={t("rules.correct_advances")} points="1" />
        </tbody>
      </table>
      <div className="border-t border-ps-border px-4 py-2.5">
        <p className="text-xs text-ps-text-sec">
          {t("rules.max_group")}{" "}
          {t("rules.max_knockout")}
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


function FAQGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group/faq" open={defaultOpen || undefined}>
      <summary className="mb-1.5 flex cursor-pointer items-center justify-between list-none [&::-webkit-details-marker]:hidden">
        <p className="font-display font-extrabold text-micro uppercase tracking-[0.12em] text-ps-text-ter">
          {title}
        </p>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-ps-text-ter transition-transform group-open/faq:rotate-180"
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
      <div className="space-y-1">{children}</div>
    </details>
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
