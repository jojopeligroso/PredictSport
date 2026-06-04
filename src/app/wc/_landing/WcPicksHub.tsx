"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Md1PicksLanding } from "./Md1PicksLanding";
import { FixturesTabs } from "@/components/wc/FixturesTabs";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import type {
  FixtureResult,
  FixturePredictionData,
} from "@/components/wc/FixturesTabs";

type HubTab = "upcoming" | "fixtures" | "results";

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
  };
}

const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Results" },
];

export function WcPicksHub({ md1, fixturesData }: WcPicksHubProps) {
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
      {/* Tab bar — pinned, uses its own max-w container */}
      <div className="sticky top-0 z-20 border-b border-ps-border bg-ps-bg/95 backdrop-blur-sm">
        <div
          role="tablist"
          className="mx-auto flex max-w-[480px] gap-0.5 px-4 pt-3 pb-0"
        >
          {HUB_TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(id)}
                className={[
                  "flex-1 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-b-2 border-ps-amber text-ps-text"
                    : "text-ps-text-sec hover:text-ps-text",
                ].join(" ")}
              >
                {label}
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
    </>
  );
}

function parseTab(value: string | null): HubTab {
  if (value === "fixtures" || value === "results") return value;
  return "upcoming";
}
