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
}

export function TournamentSection({
  todayGroups,
  todayGroupEvents,
  predictions,
  competitionId,
  windowLocked,
  groupStandings,
  bracketProgress,
}: TournamentSectionProps) {
  const t = useT();

  return (
    <>
      {/* ── 8. Today's WC Match Groups ──────────────────────────────── */}
      <OnboardingSection id="other">
        {todayGroups.length > 0 && (
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

      {/* ── 9. Bracket strip (collapsed by default) ──────────────────── */}
      {bracketProgress && (
      <OnboardingSection id="other">
        <section className="mt-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <Link
                href="/wc/bracket"
                className="flex w-full items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-colors hover:bg-ps-chip"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="text-body font-semibold text-ps-text-sec">
                    {t('dash.bracket')}
                  </span>
                  <span className="rounded-full bg-ps-purple-soft px-1.5 py-0.5 text-micro font-bold uppercase text-ps-purple">
                    {t('dash.anorak')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {bracketProgress && (
                    <span className="font-mono text-caption tabular-nums text-ps-text-sec">
                      {bracketProgress.pct}%
                    </span>
                  )}
                  <span className="text-body font-semibold tabular-nums text-ps-text">
                    →
                  </span>
                </div>
              </Link>
            </summary>
          </details>
        </section>
      </OnboardingSection>
      )}
    </>
  );
}
