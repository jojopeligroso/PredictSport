"use client";

import React from "react";

interface EventAwaitingResult {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  competition_id: string;
  external_event_id: string | null;
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
  status: string;
}

interface EventsAwaitingResultsProps {
  events: EventAwaitingResult[];
  onSelectEvent: (eventId: string) => void;
}

type UrgencyLabel = "Overdue 2+ days" | "Yesterday" | "Today";

interface AnnotatedEvent extends EventAwaitingResult {
  urgency: UrgencyLabel;
  overdue_hours: number;
}

function getUrgencyLabel(overdueHours: number): UrgencyLabel {
  if (overdueHours >= 48) return "Overdue 2+ days";
  if (overdueHours >= 24) return "Yesterday";
  return "Today";
}

function formatTimeAgo(overdueHours: number): string {
  if (overdueHours >= 48) {
    const days = Math.floor(overdueHours / 24);
    return `${days}d ago`;
  }
  if (overdueHours >= 1) {
    return `${Math.floor(overdueHours)}h ago`;
  }
  const mins = Math.floor(overdueHours * 60);
  return `${mins}m ago`;
}

function urgencyTextClass(label: UrgencyLabel): string {
  if (label === "Overdue 2+ days") return "text-[--ps-red]";
  if (label === "Yesterday") return "text-[--ps-amber]";
  return "text-[--ps-text-sec]";
}

function SportPill({ sport }: { sport: string }) {
  const label = sport
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[--ps-chip] text-[--ps-text-sec] border border-[--ps-border] capitalize whitespace-nowrap">
      {label}
    </span>
  );
}

const URGENCY_ORDER: UrgencyLabel[] = [
  "Overdue 2+ days",
  "Yesterday",
  "Today",
];

export function EventsAwaitingResults({
  events,
  onSelectEvent,
}: EventsAwaitingResultsProps) {
  const now = Date.now();

  const filtered: AnnotatedEvent[] = events
    .filter((e) => {
      if (e.result_confirmed) return false;
      if (e.status === "cancelled") return false;
      if (new Date(e.start_time).getTime() >= now) return false;
      if (
        e.result_data !== null &&
        Object.keys(e.result_data).length > 0
      )
        return false;
      return true;
    })
    .map((e) => {
      const overdue_hours =
        (now - new Date(e.start_time).getTime()) / 3_600_000;
      return {
        ...e,
        urgency: getUrgencyLabel(overdue_hours),
        overdue_hours,
      };
    })
    .sort((a, b) => b.overdue_hours - a.overdue_hours);

  if (filtered.length === 0) return null;

  const grouped = new Map<UrgencyLabel, AnnotatedEvent[]>();
  for (const label of URGENCY_ORDER) {
    const group = filtered.filter((e) => e.urgency === label);
    if (group.length > 0) grouped.set(label, group);
  }

  return (
    <div className="rounded-2xl border border-[--ps-border-strong] bg-[--ps-surface] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[--ps-border]">
        <span className="text-sm font-semibold text-[--ps-text]">
          Results Needed
        </span>
        <span className="inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-[--ps-amber] text-[#1a1208] text-xs font-bold leading-none">
          {filtered.length}
        </span>
      </div>

      {/* Groups */}
      <div className="divide-y divide-[--ps-border]">
        {Array.from(grouped.entries()).map(([label, groupEvents]) => (
          <div key={label}>
            {/* Section divider */}
            <div
              className={`px-4 py-1.5 text-xs font-semibold tracking-wide bg-[--ps-bg] ${urgencyTextClass(label)}`}
            >
              {label}
            </div>

            {/* Event rows */}
            <div className="divide-y divide-[--ps-border]">
              {groupEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEvent(event.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[--ps-chip] transition-colors group"
                >
                  {/* Event name + sport pill */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[--ps-text] truncate group-hover:text-[--ps-amber-deep]">
                      {event.event_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <SportPill sport={event.sport} />
                      <span className="text-xs text-[--ps-text-ter]">
                        {formatTimeAgo(event.overdue_hours)}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <span className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208] shadow-sm whitespace-nowrap">
                    Enter Result
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
