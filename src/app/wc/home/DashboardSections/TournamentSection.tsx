"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { FifaGroupsGrid } from "@/components/wc/FifaGroupsGrid";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

interface TournamentSectionProps {
  todayGroups: string[];
  todayGroupEvents: Map<string, WindowEvent[]>;
  predictions: Prediction[];
  competitionId: string;
  windowLocked: boolean;
  groupStandings?: Record<string, TeamWithStats[]>;
  bracketProgress: { pct: number; label: string } | null;
  knockoutActive?: boolean;
}

export function TournamentSection({
  todayGroups,
  todayGroupEvents,
  predictions,
  competitionId,
  windowLocked,
  groupStandings,
  bracketProgress,
  knockoutActive,
}: TournamentSectionProps) {
  const t = useT();

  // Once knockout stage is active, show bracket card instead of groups
  const showKnockout = knockoutActive || todayGroups.length === 0;

  return (
    <>
      <OnboardingSection id="other">
        {showKnockout ? (
          /* ── Knockout bracket card ──────────────────────────────── */
          <section className="mt-5">
            <Link
              href="/wc/bracket"
              className="group/ko flex items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-4 py-4 transition-colors hover:bg-ps-chip"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-body font-bold text-ps-text">
                    {t('dash.bracket')}
                  </span>
                </div>
                <span className="text-caption text-ps-text-ter">
                  {bracketProgress
                    ? bracketProgress.label
                    : "Knockout stage is live"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {bracketProgress && (
                  <span className="font-mono text-caption tabular-nums text-ps-text-sec">
                    {bracketProgress.pct}%
                  </span>
                )}
                <span className="text-body font-semibold text-ps-text transition-transform group-hover/ko:translate-x-0.5">
                  →
                </span>
              </div>
            </Link>
          </section>
        ) : (
          /* ── Group stage: today's groups ──────────────────────── */
          <section className="ps-panel mt-5">
            <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
              {t('dash.todays_groups')}
            </p>
            <FifaGroupsGrid
              mode="accordion"
              groupFilter={todayGroups}
              groupEvents={todayGroupEvents}
              predictions={predictions}
              competitionId={competitionId}
              windowLocked={windowLocked}
              backLabel={t('dash.todays_groups')}
              standings={groupStandings}
            />
          </section>
        )}
      </OnboardingSection>
    </>
  );
}
