"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { DashboardPickRow } from "@/components/wc/DashboardPickRow";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import { WcJoinCard } from "@/components/wc/WcJoinCard";
import { getPickStatus } from "../dashboard-utils";
import type { PickStatus } from "../dashboard-utils";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

interface PicksSectionProps {
  isMember: boolean;
  isAuthenticated: boolean;
  competitionId: string;
  filteredEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  windowLocked: boolean;
  liveEnabled: boolean;
  collapsedLiveIds: Set<string>;
  expandedEventId: string | null;
  onToggleEvent: (eventId: string, status: PickStatus) => void;
}

export function PicksSection({
  isMember,
  isAuthenticated,
  competitionId,
  filteredEvents,
  predictions,
  fixtureByEventId,
  windowLocked,
  liveEnabled,
  collapsedLiveIds,
  expandedEventId,
  onToggleEvent,
}: PicksSectionProps) {
  const t = useT();

  if (isMember) {
    return (
      <OnboardingSection id="picks">
        {filteredEvents.length > 0 && (
          <section className="mt-5">
            <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
              {t('dash.your_picks')}
            </p>
            <div className="flex flex-col gap-1.5">
              {filteredEvents.map((event) => {
                const fixture = fixtureByEventId.get(event.id);
                if (!fixture) return null;
                const status = getPickStatus(event, predictions, liveEnabled);
                // In-progress events auto-expand unless manually collapsed
                const isLiveExpanded =
                  status === "in_progress" && !collapsedLiveIds.has(event.id);
                return (
                  <DashboardPickRow
                    key={event.id}
                    fixture={fixture}
                    predictions={predictions}
                    status={status}
                    event={event}
                    competitionId={competitionId}
                    fixtureByEventId={fixtureByEventId}
                    windowLocked={windowLocked}
                    expanded={isLiveExpanded || expandedEventId === event.id}
                    onToggle={() => onToggleEvent(event.id, status)}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-center">
              <Link
                href="/wc"
                className="text-body font-semibold text-ps-amber transition-colors hover:opacity-80"
              >
                {t('dash.continue_round')}
              </Link>
            </div>
          </section>
        )}
      </OnboardingSection>
    );
  }

  return (
    /* Non-member: Join CTA */
    <section className="mt-4">
      <WcJoinCard
        isAuthenticated={isAuthenticated}
        competitionId={competitionId}
      />
    </section>
  );
}
