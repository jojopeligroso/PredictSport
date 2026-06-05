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
  const selectedGroupData = expandedGroup
    ? filteredGroups.find((g) => g.groupId === expandedGroup)
    : null;

  // ── Expanded: single group + fixtures + return CTAs ──
  if (expandedGroup && selectedGroupData) {
    return (
      <div>
        <BackToAllGroups onClick={() => setExpandedGroup(null)} />

        <div className="mx-auto mt-3 max-w-[140px]">
          <button
            onClick={() => setExpandedGroup(null)}
            className="w-full text-left"
          >
            <FifaGroupCard
              groupId={selectedGroupData.groupId}
              teams={selectedGroupData.teams}
              isExpanded
            />
          </button>
        </div>

        {groupEvents && competitionId && (
          <AccordionPanel
            groupId={expandedGroup}
            events={groupEvents.get(expandedGroup) ?? []}
            predictions={predictions ?? []}
            competitionId={competitionId}
            windowLocked={windowLocked ?? false}
          />
        )}

        <BackToAllGroups onClick={() => setExpandedGroup(null)} className="mt-4" />
      </div>
    );
  }

  // ── Collapsed: all groups grid ──
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {filteredGroups.map((g) => (
          <button
            key={g.groupId}
            onClick={() => setExpandedGroup(g.groupId)}
            className="text-left"
          >
            <FifaGroupCard
              groupId={g.groupId}
              teams={g.teams}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function BackToAllGroups({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full bg-ps-amber px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-ps-amber/85 ${className}`}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
      All groups
    </button>
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
