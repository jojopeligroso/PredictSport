"use client";

import { useState } from "react";
import { EventsSection } from "./EventsSection";
import { ParticipantsSection } from "./ParticipantsSection";
import { NominationsSection } from "./NominationsSection";
import { SettingsSection } from "./SettingsSection";
import type { Competition, Event, CompetitionMember, EventNomination, InviteToken, EventPredictionType, Round } from "@/types/database";

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
}

type Tab = "Confirm Results" | "Add Event" | "Nominations" | "Members" | "Settings";

export function CompetitionTabs({
  competition,
  events,
  rounds,
  members,
  nominations,
  inviteTokens,
  currentUserId,
}: CompetitionTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Confirm Results");

  const pendingNominationCount = (nominations ?? []).filter(
    (n) => n.status === "pending"
  ).length;

  const eventsToConfirm = (events ?? []).filter(
    (e) => e.result_data && !e.result_confirmed && e.status !== "cancelled"
  ).length;

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "Confirm Results", label: "Confirm Results", count: eventsToConfirm || undefined },
    { id: "Add Event", label: "Add Event" },
    { id: "Nominations", label: "Nominations", count: pendingNominationCount || undefined },
    { id: "Members", label: "Members" },
    { id: "Settings", label: "Settings" },
  ];

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
        {(activeTab === "Confirm Results" || activeTab === "Add Event") && (
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
        {activeTab === "Settings" && (
          <SettingsSection competition={competition} />
        )}
      </div>
    </div>
  );
}
