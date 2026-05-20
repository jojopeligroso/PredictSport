"use client";

import { useState } from "react";
import { EventsSection } from "./EventsSection";
import { ParticipantsSection } from "./ParticipantsSection";
import { NominationsSection } from "./NominationsSection";
import { NominateSection } from "./NominateSection";
import { SettingsSection } from "./SettingsSection";
import type { Competition, Event, CompetitionMember, EventNomination, InviteToken, EventPredictionType, Round } from "@/types/database";
import { PredictionWindowSelector } from "@/components/tournament/PredictionWindowSelector";
import { FinalisationPanel } from "@/components/tournament/admin/FinalisationPanel";

interface EventWithPredictionTypes extends Event {
  event_prediction_types: EventPredictionType[];
}

interface CompetitionTabsProps {
  competition: Competition;
  events: EventWithPredictionTypes[];
  rounds: Round[];
  members: (CompetitionMember & { user?: { display_name: string; email: string } })[];
  nominations: (EventNomination & { nominator?: { display_name: string } })[];
  inviteTokens: InviteToken[];
  currentUserId: string;
  userRole?: "admin" | "co_admin" | "participant";
  hasClassifications?: boolean;
  hasBracket?: boolean;
  finalisationData?: {
    windows: { id: string; name: string; status: string; totalEvents: number; confirmedEvents: number }[];
    stages: { id: string; name: string; status: string; totalWindows: number; scoredWindows: number }[];
  };
}

type Tab = "Events" | "Confirm Results" | "Add Event" | "Nominations" | "Nominate" | "Members" | "Settings" | "Prediction Windows" | "Finalise";

export function CompetitionTabs({
  competition,
  events,
  rounds,
  members,
  nominations,
  inviteTokens,
  currentUserId,
  userRole = "admin",
  hasClassifications = false,
  finalisationData,
}: CompetitionTabsProps) {
  const isAdmin = userRole === "admin" || userRole === "co_admin";
  const defaultTab: Tab = isAdmin ? "Confirm Results" : "Events";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const pendingNominationCount = (nominations ?? []).filter(
    (n) => n.status === "pending"
  ).length;

  const eventsToConfirm = (events ?? []).filter(
    (e) => e.result_data && !e.result_confirmed && e.status !== "cancelled"
  ).length;

  const allTabs: Array<{ id: Tab; label: string; count?: number; adminOnly?: boolean; show?: boolean }> = [
    { id: "Events", label: "Events", adminOnly: false },
    { id: "Confirm Results", label: "Confirm Results", count: eventsToConfirm || undefined, adminOnly: true },
    { id: "Add Event", label: "Add Event", adminOnly: true },
    { id: "Nominations", label: "Nominations", count: pendingNominationCount || undefined, adminOnly: true },
    { id: "Nominate", label: "Nominate", adminOnly: false, show: competition.allow_nominations },
    { id: "Prediction Windows", label: "Windows", adminOnly: false, show: hasClassifications },
    { id: "Finalise", label: "Finalise", adminOnly: true, show: hasClassifications },
    { id: "Members", label: "Members", adminOnly: false },
    { id: "Settings", label: "Settings", adminOnly: true },
  ];

  const tabs = allTabs.filter((tab) => (isAdmin || !tab.adminOnly) && (tab.show !== false));

  return (
    <div>
      {/* Pill-style segmented tab bar */}
      <div
        className="grid gap-0.5 rounded-[10px] p-[3px]"
        style={{
          background: "rgba(40,30,20,0.06)",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 rounded-[7px] py-[7px] px-1.5 text-[11px] font-bold transition-colors ${
              activeTab === tab.id
                ? "bg-ps-surface text-ps-text shadow-[0_1px_3px_rgba(40,30,20,0.08)]"
                : "text-ps-text-sec"
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className="rounded-full bg-ps-amber text-[#1a1208]"
                style={{ padding: "1px 5px", fontSize: 9, fontWeight: 800 }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {(activeTab === "Events" || activeTab === "Confirm Results" || activeTab === "Add Event") && (
          <EventsSection
            competition={competition}
            events={events}
            rounds={rounds}
          />
        )}
        {activeTab === "Members" && (
          <ParticipantsSection
            competition={competition}
            members={members}
            inviteTokens={inviteTokens}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === "Nominations" && (
          <NominationsSection
            competition={competition}
            nominations={nominations}
          />
        )}
        {activeTab === "Nominate" && (
          <NominateSection
            competition={competition}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === "Prediction Windows" && (
          <PredictionWindowSelector
            windows={rounds
              .filter((r) => r.sporting_stage_id)
              .map((r) => ({
                id: r.id,
                name: r.name ?? `Round ${r.round_number}`,
                round_number: r.round_number,
                status: r.status ?? "open",
                deadline: null,
                sporting_stage_id: r.sporting_stage_id ?? null,
                prediction_window_number: r.prediction_window_number ?? null,
                eventCount: (events ?? []).filter((e) => e.round_id === r.id).length,
                earliestLock: null,
                allResulted: (events ?? []).filter((e) => e.round_id === r.id).every((e) => e.result_confirmed),
                userPredictionCount: 0,
              }))}
            competitionId={competition.id}
            basePath={`/competitions/${competition.id}/picks`}
          />
        )}
        {activeTab === "Finalise" && finalisationData && (
          <FinalisationPanel
            windows={finalisationData.windows}
            stages={finalisationData.stages}
          />
        )}
        {activeTab === "Finalise" && !finalisationData && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            No finalisation data available.
          </p>
        )}
        {activeTab === "Settings" && (
          <SettingsSection competition={competition} />
        )}
      </div>
    </div>
  );
}
