import { CountryFlag } from "@/components/CountryFlag";
import { FixtureCardSurface } from "@/components/wc/FixtureCardSurface";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

type PickStatus = "complete" | "urgent" | "unpicked";

interface DashboardPickRowProps {
  fixture: WcFixture;
  predictions: Prediction[];
  status: PickStatus;
}

/**
 * DashboardPickRow — condensed match row on the Home dashboard.
 *
 * Shows host-city-colored card with team flags + FIFA trigrams.
 * Visual states:
 *  - complete: gold halo + green check
 *  - urgent: violet pulsing border + "< 24H" badge
 *  - unpicked: plain card, no decorations
 */
export function DashboardPickRow({
  fixture,
  predictions,
  status,
}: DashboardPickRowProps) {
  const homeTrigram = fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTrigram = fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  // Has both winner + exact_score predictions?
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

  return (
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

        {/* Status indicator */}
        {status === "complete" && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ps-green text-white">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </span>
        )}
        {status === "urgent" && (
          <span className="animate-pulse rounded-full bg-ps-purple/80 px-2 py-0.5 text-[10px] font-bold text-white">
            &lt; 24H
          </span>
        )}
        {status === "unpicked" && (
          <span className="h-5 w-5 rounded-full border-2 border-white/30" />
        )}
      </div>
    </FixtureCardSurface>
  );
}
