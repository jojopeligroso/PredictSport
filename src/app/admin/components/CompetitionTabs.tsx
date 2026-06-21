"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventsSection } from "./EventsSection";
import { ParticipantsSection } from "./ParticipantsSection";
import { NominationsSection } from "./NominationsSection";
import { NominateSection } from "./NominateSection";
import { SettingsSection } from "./SettingsSection";
import { ResultPanel } from "./ResultPanel";
import { RoundBuilder } from "./RoundBuilder";
import type { Competition, Event, CompetitionMember, EventNomination, InviteToken, EventPredictionType, Round, MemberTag } from "@/types/database";
import { PredictionWindowSelector } from "@/components/tournament/PredictionWindowSelector";
import { FinalisationPanel } from "@/components/tournament/admin/FinalisationPanel";
import { ClassificationTabs } from "@/components/tournament/ClassificationTabs";

interface EventWithPredictionTypes extends Event {
  event_prediction_types: EventPredictionType[];
}

interface CompetitionTabsProps {
  competition: Competition;
  events: EventWithPredictionTypes[];
  rounds: Round[];
  members: (CompetitionMember & { user?: { display_name: string; email: string } })[];
  memberTags?: MemberTag[];
  nominations: (EventNomination & { nominator?: { display_name: string } })[];
  inviteTokens: InviteToken[];
  currentUserId: string;
  userRole?: "admin" | "co_admin" | "participant";
  hasClassifications?: boolean;
  hasBracket?: boolean;
  classifications?: { id: string; classification_key: string; name: string; classification_type: string; status: string }[];
  finalisationData?: {
    windows: { id: string; name: string; status: string; totalEvents: number; confirmedEvents: number }[];
    stages: { id: string; name: string; status: string; totalWindows: number; scoredWindows: number }[];
  };
}

type Tab = "Events" | "Confirm Results" | "Add Event" | "Nominations" | "Nominate" | "Members" | "Settings" | "Prediction Windows" | "Standings" | "Finalise";

export function CompetitionTabs({
  competition,
  events,
  rounds,
  members,
  memberTags = [],
  nominations,
  inviteTokens,
  currentUserId,
  userRole = "admin",
  hasClassifications = false,
  classifications = [],
  finalisationData,
}: CompetitionTabsProps) {
  const isAdmin = userRole === "admin" || userRole === "co_admin";
  const defaultTab: Tab = isAdmin ? "Confirm Results" : "Events";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const router = useRouter();

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
    { id: "Standings", label: "Standings", adminOnly: false, show: hasClassifications },
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
        {activeTab === "Events" && (
          <EventsSection
            competition={competition}
            events={events}
            rounds={rounds}
            userRole={userRole}
          />
        )}
        {activeTab === "Confirm Results" && (
          <div>
            <h3 className="text-lg font-semibold text-ps-text mb-4">Confirm Results</h3>
            {(() => {
              const toConfirm = (events ?? []).filter(
                (e) => e.result_data && !e.result_confirmed && e.status !== "cancelled"
              );
              if (toConfirm.length === 0) {
                return (
                  <p className="py-8 text-center text-sm text-ps-text-sec">
                    No results awaiting confirmation.
                  </p>
                );
              }
              return (
                <div className="space-y-4">
                  {toConfirm.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-ps-border bg-ps-surface p-4">
                      <div className="mb-3">
                        <h4 className="font-medium text-ps-text">{event.event_name}</h4>
                        <p className="mt-0.5 text-xs text-ps-text-ter capitalize">
                          {event.sport.replace(/_/g, " ")} &middot; {new Date(event.start_time).toLocaleString()}
                        </p>
                        {event.result_data && (
                          <pre className="mt-2 rounded-xl bg-ps-chip px-3 py-2 text-xs text-ps-text-sec overflow-x-auto">
                            {JSON.stringify(event.result_data, null, 2)}
                          </pre>
                        )}
                      </div>
                      <ResultPanel
                        event={event}
                        competitionId={competition.id}
                        onConfirmed={() => router.refresh()}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === "Add Event" && (() => {
          const nextRoundNumber =
            rounds.length > 0
              ? Math.max(...rounds.map((r) => r.round_number)) + 1
              : 1;
          return (
            <RoundBuilder
              competitionId={competition.id}
              nextRoundNumber={nextRoundNumber}
              scoringRules={competition.scoring_rules as Record<string, unknown>}
              lockDefaultMinutes={competition.lock_default_minutes}
              onSuccess={() => router.refresh()}
              onCancel={() => setActiveTab("Events")}
            />
          );
        })()}
        {activeTab === "Members" && (
          <ParticipantsSection
            competition={competition}
            members={members}
            memberTags={memberTags}
            inviteTokens={inviteTokens}
            currentUserId={currentUserId}
            userRole={userRole}
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
                userScoreCount: 0,
                scoreEligibleCount: 0,
              }))}
            competitionId={competition.id}
            basePath={`/competitions/${competition.id}/picks`}
          />
        )}
        {activeTab === "Standings" && classifications.length > 0 && (
          <ClassificationTabs
            classifications={classifications}
            competitionId={competition.id}
            currentUserId={currentUserId}
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
          <SettingsSection competition={competition} userRole={userRole} />
        )}
      </div>
    </div>
  );
}
