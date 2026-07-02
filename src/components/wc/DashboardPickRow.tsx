"use client";

import { useT, useLocale } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { FixtureCardSurface } from "@/components/wc/FixtureCardSurface";
import { WindowPickList } from "@/app/wc/picks/[windowId]/WindowPickList";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

type PickStatus = "complete" | "urgent" | "unpicked" | "in_progress";

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
 *  - in_progress: red pulsing "LIVE" badge, auto-expanded, locked prediction
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
  const t = useT();
  const { locale } = useLocale();
  const homeTrigram = fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTrigram = fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  // Gold halo for events with complete predictions (including locked in-progress)
  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  const hasWinnerAndScore =
    eventPreds.some((p) => p.prediction_type === "winner") &&
    eventPreds.some((p) => p.prediction_type === "exact_score");
  const hasPick = status === "complete" || (status === "in_progress" && hasWinnerAndScore);

  // Format kickoff in the user's local timezone (Intl defaults to browser tz
  // when timeZone is omitted, which correctly handles DST transitions).
  const ko = new Date(fixture.kickoffUtc);
  const intlLocale = locale === "es" ? "es-MX" : "en-GB";
  const timeStr = ko.toLocaleTimeString(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = ko.toLocaleDateString(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const isLive = status === "in_progress";

  // When expanded, render only the WindowPickList card (it supplies its own
  // FixtureCardSurface via surface="card").
  if (expanded) {
    return (
      <div>
        {/* Tap the expanded card again to collapse — thin tap strip above the pick UI */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={t('picks.collapse_card')}
          className="mb-1 w-full min-h-[44px] py-1.5 text-left text-micro font-semibold uppercase tracking-wider text-ps-text-ter flex items-center gap-1"
        >
          <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {isLive && (
            <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t('picks.live')}
            </span>
          )}
          {t('picks.collapse_card')}
        </button>
        <div className="animate-in slide-in-from-top-2 duration-200">
          <WindowPickList
            competitionId={competitionId}
            events={[event]}
            predictions={predictions}
            windowLocked={isLive || windowLocked}
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
      aria-label={
        isLive
          ? `${fixture.home} vs ${fixture.away} — ${t('picks.live')}`
          : t('picks.tap_to_pick', { home: fixture.home, away: fixture.away })
      }
      className="w-full text-left active:scale-[0.98] transition-transform duration-75"
    >
      <FixtureCardSurface
        city={fixture.city}
        headerLeft={
          <span>
            {t('fixtures.stage_group', { group: fixture.group ?? '', matchday: fixture.matchday ?? '' })}
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
              <span className="text-caption font-semibold text-white/80">{t('picks.edit')}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ps-green text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
            </span>
          )}
          {status === "urgent" && (
            <span className="flex items-center gap-1.5">
              <span className="text-caption font-bold text-white">{t('fixtures.pick_cta')}</span>
              <span className="animate-pulse rounded-full bg-ps-purple/80 px-2 py-0.5 text-micro font-bold text-white">
                {t('picks.urgent_24h')}
              </span>
            </span>
          )}
          {status === "in_progress" && (
            <span className="flex items-center gap-1.5">
              {hasWinnerAndScore && (
                <span className="text-caption font-semibold text-white/80">{t('picks.your_pick')}</span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-2 py-0.5 text-micro font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {t('picks.live')}
              </span>
            </span>
          )}
          {status === "unpicked" && (
            <span className="text-caption font-bold text-white/90">{t('fixtures.pick_cta')}</span>
          )}
        </div>
      </FixtureCardSurface>
    </button>
  );
}
