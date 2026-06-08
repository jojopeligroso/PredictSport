"use client";

import { useState } from "react";
import { FifaGroupCard } from "./FifaGroupCard";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { WindowPickList, type WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { Prediction } from "@/types/database";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

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
  /** Label for the back button in accordion mode (default "All groups"). */
  backLabel?: string;
  /** Live group standings keyed by group letter. */
  standings?: Record<string, TeamWithStats[]>;
}

export function FifaGroupsGrid({
  mode,
  groupFilter,
  groupEvents,
  predictions,
  competitionId,
  windowLocked,
  backLabel,
  standings,
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
          <FifaGroupCard
            key={g.groupId}
            groupId={g.groupId}
            teams={g.teams}
            standings={standings?.[g.groupId]}
          />
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
    const groupStandings = standings?.[expandedGroup];
    return (
      <div>
        <BackToAllGroups onClick={() => setExpandedGroup(null)} label={backLabel} />

        <div className="mx-auto mt-3 max-w-[140px]">
          <button
            onClick={() => setExpandedGroup(null)}
            className="w-full text-left"
          >
            <FifaGroupCard
              groupId={selectedGroupData.groupId}
              teams={selectedGroupData.teams}
              standings={groupStandings}
              isExpanded
            />
          </button>
        </div>

        {groupStandings && groupStandings.length > 0 && (
          <div className="mt-3 rounded-xl border border-ps-border bg-ps-surface p-3">
            <GroupTable standings={groupStandings} />
          </div>
        )}

        {groupEvents && competitionId && (
          <AccordionPanel
            groupId={expandedGroup}
            events={groupEvents.get(expandedGroup) ?? []}
            predictions={predictions ?? []}
            competitionId={competitionId}
            windowLocked={windowLocked ?? false}
          />
        )}

        <BackToAllGroups onClick={() => setExpandedGroup(null)} label={backLabel} className="mt-4" />
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
              standings={standings?.[g.groupId]}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function BackToAllGroups({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label?: string;
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
      {label ?? "All groups"}
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

/** FIFA-style group standings table using the ps-* design tokens. */
function GroupTable({ standings }: { standings: TeamWithStats[] }) {
  const thClass =
    "pb-2 text-center font-mono text-[11px] font-semibold text-ps-text-ter";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-ps-border">
            <th className={`${thClass} w-7 text-left`}>#</th>
            <th className={`${thClass} text-left`}>Team</th>
            <th className={thClass}>P</th>
            <th className={thClass}>W</th>
            <th className={thClass}>D</th>
            <th className={thClass}>L</th>
            <th className={thClass}>GF</th>
            <th className={thClass}>GA</th>
            <th className={thClass}>GD</th>
            <th className={`${thClass} font-bold`}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => {
            const isQ = [1, 2].includes(team.position ?? 0);
            const gd = team.goalDifference ?? team.gd ?? 0;
            return (
              <tr
                key={team.name}
                className={[
                  "border-b border-ps-border/40",
                  isQ ? "bg-ps-green-soft" : "",
                ].join(" ")}
              >
                <td className="py-2 text-left">
                  <span
                    className={[
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                      isQ
                        ? "bg-ps-green text-white"
                        : "bg-ps-chip text-ps-text-ter",
                    ].join(" ")}
                  >
                    {team.position}
                  </span>
                </td>
                <td className="py-2 text-left font-sans text-[13px] font-semibold text-ps-text">
                  <span className="inline-flex items-center gap-1.5">
                    <CountryFlag shape="pill" name={team.name} size={16} />
                    <span className="hidden min-[360px]:inline">
                      {fifaTrigram(team.name) ?? team.name.slice(0, 3).toUpperCase()}
                    </span>
                  </span>
                </td>
                <td className="py-2 text-center text-ps-text-sec">
                  {team.played ?? ((team.wins ?? 0) + (team.draws ?? 0) + (team.losses ?? 0))}
                </td>
                <td className="py-2 text-center text-ps-text-sec">{team.wins}</td>
                <td className="py-2 text-center text-ps-text-sec">{team.draws}</td>
                <td className="py-2 text-center text-ps-text-sec">{team.losses}</td>
                <td className="py-2 text-center text-ps-text-sec">
                  {team.goalsFor ?? team.gs}
                </td>
                <td className="py-2 text-center text-ps-text-sec">
                  {team.goalsAgainst ?? team.gc}
                </td>
                <td
                  className={[
                    "py-2 text-center",
                    gd > 0 ? "text-ps-green" : gd < 0 ? "text-ps-red" : "text-ps-text-sec",
                  ].join(" ")}
                >
                  {gd > 0 ? "+" : ""}
                  {gd}
                </td>
                <td className="py-2 text-center font-bold text-ps-text">
                  {team.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-ps-text-ter">
        <div className="h-2.5 w-2.5 rounded-full bg-ps-green" />
        <span>Qualifies for knockout stage</span>
      </div>
    </div>
  );
}
