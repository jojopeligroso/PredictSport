"use client";

import { useState } from "react";
import { FifaGroupCard } from "./FifaGroupCard";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { WindowPickList, type WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

interface FifaGroupsGridProps {
  mode: "compact" | "accordion";
  /** Group events keyed by group letter, needed for accordion mode. */
  groupEvents?: Map<string, WindowEvent[]>;
  /** User predictions, needed for accordion mode. */
  predictions?: Prediction[];
  /** Competition ID, needed for accordion mode. */
  competitionId?: string;
}

export function FifaGroupsGrid({
  mode,
  groupEvents,
  predictions,
  competitionId,
}: FifaGroupsGridProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (mode === "compact") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {WC2026_GROUPS.map((g) => (
          <FifaGroupCard key={g.groupId} groupId={g.groupId} teams={g.teams} />
        ))}
      </div>
    );
  }

  // accordion mode
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {WC2026_GROUPS.map((g) => {
          const isOpen = expandedGroup === g.groupId;
          return (
            <button
              key={g.groupId}
              onClick={() =>
                setExpandedGroup(isOpen ? null : g.groupId)
              }
              className={`text-left transition-colors ${
                isOpen ? "ring-2 ring-ps-amber rounded-lg" : ""
              }`}
            >
              <FifaGroupCard groupId={g.groupId} teams={g.teams} />
            </button>
          );
        })}
      </div>

      {expandedGroup && groupEvents && competitionId && (
        <AccordionPanel
          groupId={expandedGroup}
          events={groupEvents.get(expandedGroup) ?? []}
          predictions={predictions ?? []}
          competitionId={competitionId}
        />
      )}
    </div>
  );
}

function AccordionPanel({
  groupId,
  events,
  predictions,
  competitionId,
}: {
  groupId: string;
  events: WindowEvent[];
  predictions: Prediction[];
  competitionId: string;
}) {
  if (events.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-ps-border bg-ps-surface px-4 py-3 text-center">
        <p className="text-xs text-ps-text-sec">
          No Group {groupId} fixtures loaded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-ps-text">
        Group {groupId} matches
      </p>
      <WindowPickList
        competitionId={competitionId}
        events={events}
        predictions={predictions}
        windowLocked={false}
        surface="compact"
      />
    </div>
  );
}
