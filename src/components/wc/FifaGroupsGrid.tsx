"use client";

import { useState } from "react";
import { FifaGroupCard } from "./FifaGroupCard";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { WindowPickList, type WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

interface FifaGroupsGridProps {
  mode: "compact" | "accordion";
  /** Only show these groups (e.g. groups with matches today). Shows all if omitted/empty. */
  groupFilter?: string[];
  /** Group events keyed by group letter, needed for accordion mode. */
  groupEvents?: Map<string, WindowEvent[]>;
  /** User predictions, needed for accordion mode. */
  predictions?: Prediction[];
  /** Competition ID, needed for accordion mode. */
  competitionId?: string;
  /** Lock the pick list (non-members, locked rounds). */
  windowLocked?: boolean;
}

export function FifaGroupsGrid({
  mode,
  groupFilter,
  groupEvents,
  predictions,
  competitionId,
  windowLocked,
}: FifaGroupsGridProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filteredGroups =
    groupFilter && groupFilter.length > 0
      ? WC2026_GROUPS.filter((g) => groupFilter.includes(g.groupId))
      : WC2026_GROUPS;

  if (mode === "compact") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {filteredGroups.map((g) => (
          <FifaGroupCard key={g.groupId} groupId={g.groupId} teams={g.teams} />
        ))}
      </div>
    );
  }

  // accordion mode
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {filteredGroups.map((g) => {
          const isOpen = expandedGroup === g.groupId;
          return (
            <button
              key={g.groupId}
              onClick={() =>
                setExpandedGroup(isOpen ? null : g.groupId)
              }
              className="text-left"
            >
              <FifaGroupCard
                groupId={g.groupId}
                teams={g.teams}
                isExpanded={isOpen}
              />
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
          windowLocked={windowLocked ?? false}
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
  windowLocked,
}: {
  groupId: string;
  events: WindowEvent[];
  predictions: Prediction[];
  competitionId: string;
  windowLocked: boolean;
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
        windowLocked={windowLocked}
        surface="compact"
      />
    </div>
  );
}
