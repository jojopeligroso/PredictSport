"use client";

import { useState } from "react";
import { EventsSection } from "./EventsSection";
import { ParticipantsSection } from "./ParticipantsSection";
import { NominationsSection } from "./NominationsSection";
import { SettingsSection } from "./SettingsSection";
import type { Competition, Event, CompetitionMember, EventNomination, InviteToken } from "@/types/database";

interface CompetitionTabsProps {
  competition: Competition;
  events: Event[];
  members: (CompetitionMember & { user?: { display_name: string; email: string } })[];
  nominations: (EventNomination & { nominator?: { display_name: string } })[];
  inviteTokens: InviteToken[];
  currentUserId: string;
}

const TABS = ["Events", "Participants", "Nominations", "Settings"] as const;
type Tab = (typeof TABS)[number];

export function CompetitionTabs({
  competition,
  events,
  members,
  nominations,
  inviteTokens,
  currentUserId,
}: CompetitionTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Events");

  const pendingNominationCount = (nominations ?? []).filter(
    (n) => n.status === "pending"
  ).length;

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-4" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {tab}
              {tab === "Nominations" && pendingNominationCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {pendingNominationCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "Events" && (
          <EventsSection
            competition={competition}
            events={events}
          />
        )}
        {activeTab === "Participants" && (
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
