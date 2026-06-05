"use client";

import { CountryFlag } from "@/components/CountryFlag";
import { FixtureCardSurface } from "@/components/wc/FixtureCardSurface";
import { WindowPickList } from "@/app/wc/picks/[windowId]/WindowPickList";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

type PickStatus = "complete" | "urgent" | "unpicked";

interface DashboardPickRowProps {
  fixture: WcFixture;
  predictions: Prediction[];
  status: PickStatus;
  event: WindowEvent;
  competitionId: string;
  fixtureByEventId: Map<string, WcFixture>;
  windowLocked: boolean;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * DashboardPickRow — tappable condensed match card on the Home dashboard.
 *
 * Collapsed: host-city-colored card with team flags + FIFA trigrams + CTA.
 * Expanded: replaces the condensed card with the full WindowPickList UI.
 *
 * Visual states:
 *  - complete: gold halo + green check / "Edit" CTA
 *  - urgent: violet pulsing border + "< 24H" badge + "Pick →" CTA
 *  - unpicked: plain card + "Pick →" CTA
 */
export function DashboardPickRow({
  fixture,
  predictions,
  status,
  event,
  competitionId,
  fixtureByEventId,
  windowLocked,
  expanded,
  onToggle,
}: DashboardPickRowProps) {
  const homeTrigram = fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTrigram = fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  const hasPick = status === "complete";

  // Format kickoff
  const ko = new Date(fixture.kickoffUtc);
  const timeStr = ko.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const dateStr = ko.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  // When expanded, render only the WindowPickList card (it supplies its own
  // FixtureCardSurface via surface="card").
  if (expanded) {
    return (
      <div>
        {/* Tap the expanded card again to collapse — thin tap strip above the pick UI */}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse pick card"
          className="mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-ps-text-ter flex items-center gap-1"
        >
          <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Collapse
        </button>
        <div className="animate-in slide-in-from-top-2 duration-200">
          <WindowPickList
            competitionId={competitionId}
            events={[event]}
            predictions={predictions}
            windowLocked={windowLocked}
            surface="card"
            fixtureByEventId={fixtureByEventId}
          />
        </div>
      </div>
    );
  }

  // Collapsed condensed view — tappable.
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${fixture.home} vs ${fixture.away} — tap to pick`}
      className="w-full text-left"
    >
      <FixtureCardSurface
        city={fixture.city}
        headerLeft={
          <span>
            Group {fixture.group} · MD{fixture.matchday}
          </span>
        }
        headerRight={
          <span>
            {timeStr} · {dateStr}
          </span>
        }
        hasPick={hasPick}
      >
        <div className="flex items-center gap-2">
          {/* Home team */}
          <CountryFlag name={fixture.home} size={20} shape="pill" />
          <span className="text-base font-bold text-white">{homeTrigram}</span>

          <span className="mx-1 text-xs text-white/60">vs</span>

          {/* Away team */}
          <span className="text-base font-bold text-white">{awayTrigram}</span>
          <CountryFlag name={fixture.away} size={20} shape="pill" />

          {/* Spacer */}
          <span className="flex-1" />

          {/* Status indicator + CTA */}
          {status === "complete" && (
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-white/80">Edit</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ps-green text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
            </span>
          )}
          {status === "urgent" && (
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white">Pick →</span>
              <span className="animate-pulse rounded-full bg-ps-purple/80 px-2 py-0.5 text-[10px] font-bold text-white">
                &lt; 24H
              </span>
            </span>
          )}
          {status === "unpicked" && (
            <span className="text-[11px] font-bold text-white/90">Pick →</span>
          )}
        </div>
      </FixtureCardSurface>
    </button>
  );
}
