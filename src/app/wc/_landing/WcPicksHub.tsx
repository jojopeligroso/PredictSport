"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Md1PicksLanding } from "./Md1PicksLanding";
import { FixturesTabs } from "@/components/wc/FixturesTabs";
import { FifaGroupsGrid } from "@/components/wc/FifaGroupsGrid";
import { OnboardingHomeSpotlight } from "@/components/wc/OnboardingFlow";
import { useT } from "@/lib/i18n";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import type {
  FixtureResult,
  FixturePredictionData,
} from "@/components/wc/FixturesTabs";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

type HubTab = "upcoming" | "fixtures" | "results" | "groups";

// Tab label keys indexed by tab id — used inside the component where t() is available
const HUB_TAB_IDS: HubTab[] = ["upcoming", "fixtures", "results", "groups"];
const HUB_TAB_KEYS: Record<HubTab, string> = {
  upcoming: "wc.tab_upcoming",
  fixtures: "wc.tab_fixtures",
  results: "wc.tab_results",
  groups: "wc.tab_groups",
};

interface WcPicksHubProps {
  /** Data for the Upcoming (picks) tab. */
  md1: {
    competitionId: string;
    events: WindowEvent[];
    predictions: Prediction[];
    fixtureByEventId: Map<string, WcFixture>;
    isMember: boolean;
    isAuthenticated: boolean;
    windowLocked: boolean;
  };
  /** Data for the Fixtures and Results tabs. */
  fixturesData: {
    fixtures: WcFixture[];
    resultsByExternalId: Record<string, FixtureResult | undefined>;
    predictionsByExternalId: Record<string, FixturePredictionData>;
    serverDateIso: string;
    windowEventsByExternalId: Record<string, WindowEvent>;
    fixtureByEventId: Map<string, WcFixture>;
    fullPredictions: Prediction[];
    competitionId: string | null;
    isMember: boolean;
  };
  /** Data for the Groups tab. */
  groupsData?: {
    competitionId: string;
    groupEvents: Map<string, WindowEvent[]>;
    predictions: Prediction[];
    groupStandings?: Record<string, TeamWithStats[]>;
  } | null;
}

export function WcPicksHub({ md1, fixturesData, groupsData }: WcPicksHubProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const initialTab = parseTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<HubTab>(initialTab);

  const handleTabChange = (tab: HubTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "upcoming") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <>
      {/* Onboarding step 5: spotlight the Home icon */}
      <OnboardingHomeSpotlight />

      {/* Tab bar — pinned, uses its own max-w container */}
      <div className="sticky top-0 z-20 border-b border-ps-border bg-ps-bg/95 backdrop-blur-sm">
        <div
          role="tablist"
          className="mx-auto flex max-w-[480px] items-end gap-0.5 px-4 pt-3 pb-0"
        >
          {/* Home icon — gold house, links to /wc/home */}
          <a
            href="/wc/home"
            aria-label="Home"
            className="mr-1 flex-shrink-0 -translate-y-1 pb-2"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d4af37"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </a>
          {HUB_TAB_IDS.map((id) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(id)}
                className={[
                  "flex-1 rounded-t-lg px-1.5 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "border-b-2 border-ps-amber text-ps-text"
                    : "text-ps-text-sec hover:text-ps-text",
                ].join(" ")}
              >
                {t(HUB_TAB_KEYS[id])}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — each tab provides its own container */}
      {activeTab === "upcoming" && (
        <Md1PicksLanding
          competitionId={md1.competitionId}
          events={md1.events}
          predictions={md1.predictions}
          fixtureByEventId={md1.fixtureByEventId}
          isMember={md1.isMember}
          isAuthenticated={md1.isAuthenticated}
          windowLocked={md1.windowLocked}
        />
      )}

      {activeTab === "fixtures" && (
        <div className="mx-auto max-w-[480px] px-4 pt-2 pb-16">
          <FixturesTabs
            fixtures={fixturesData.fixtures}
            resultsByExternalId={fixturesData.resultsByExternalId}
            serverDateIso={fixturesData.serverDateIso}
            mode="fixtures"
            windowEventsByExternalId={fixturesData.windowEventsByExternalId}
            fixtureByEventId={fixturesData.fixtureByEventId}
            fullPredictions={fixturesData.fullPredictions}
            competitionId={fixturesData.competitionId}
            isMember={fixturesData.isMember}
          />
        </div>
      )}

      {activeTab === "results" && (
        <div className="mx-auto max-w-[480px] px-4 pt-2 pb-16">
          <FixturesTabs
            fixtures={fixturesData.fixtures}
            resultsByExternalId={fixturesData.resultsByExternalId}
            predictionsByExternalId={fixturesData.predictionsByExternalId}
            serverDateIso={fixturesData.serverDateIso}
            mode="results"
          />
        </div>
      )}

      {activeTab === "groups" && (
        <div className="mx-auto max-w-[480px] px-4 pt-4 pb-16">
          <div className="relative">
            <div
              className={
                !md1.isMember
                  ? "pointer-events-none select-none [filter:blur(6px)_saturate(0.7)]"
                  : ""
              }
              aria-hidden={!md1.isMember || undefined}
            >
              <FifaGroupsGrid
                mode="accordion"
                groupEvents={groupsData?.groupEvents}
                predictions={groupsData?.predictions}
                competitionId={groupsData?.competitionId}
                windowLocked={md1.windowLocked || !md1.isMember}
                standings={groupsData?.groupStandings}
              />
            </div>
            {!md1.isMember && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6">
                <div className="pointer-events-auto rounded-2xl border border-ps-border bg-ps-surface px-5 py-5 text-center shadow-lg">
                  <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-ps-text">
                    {t("wc.join_to_pick")}
                  </h2>
                  <p className="mt-1.5 text-xs text-ps-text-sec">
                    {t("wc.join_to_pick_desc")}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabChange("upcoming")}
                    className="mt-3 w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90"
                  >
                    {t("wc.go_to_upcoming")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function parseTab(value: string | null): HubTab {
  if (value === "fixtures" || value === "results" || value === "groups") return value;
  return "upcoming";
}
