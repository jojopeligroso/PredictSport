"use client";

import { useEffect, useMemo, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { HOST_CITIES, type HostCitySlug } from "@/lib/wc/host-cities";
import type { WcFixture } from "@/lib/wc/fixtures";

export type FixtureResult = {
  /** "scheduled" | "live" | "resulted" | "locked" */
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  isFinalised: boolean;
};

type TabId = "today" | "upcoming" | "results";

interface Props {
  fixtures: WcFixture[];
  /** Keyed by `WcFixture.externalId`. */
  resultsByExternalId: Record<string, FixtureResult | undefined>;
  /** ISO date (YYYY-MM-DD) — defaults to server's date; client recalculates on mount. */
  serverDateIso: string;
}

export function FixturesTabs({ fixtures, resultsByExternalId, serverDateIso }: Props) {
  // Render server-side with the server's idea of "today", then re-derive on
  // mount from the browser. Avoids hydration mismatch on the timezone shift.
  const [todayIso, setTodayIso] = useState(serverDateIso);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setNow(d);
      setTodayIso(localDateIso(d));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const [tab, setTab] = useState<TabId>("today");

  const buckets = useMemo(() => {
    const today: WcFixture[] = [];
    const upcoming: WcFixture[] = [];
    const results: WcFixture[] = [];
    for (const f of fixtures) {
      const kickoff = new Date(f.kickoffUtc);
      const result = resultsByExternalId[f.externalId];
      const isFinished = !!result && (result.homeScore !== null || result.winner !== null);
      const isToday = localDateIso(kickoff) === todayIso;

      if (isFinished) {
        results.push(f);
      } else if (kickoff.getTime() < now.getTime()) {
        // Past kickoff but no result yet — show under Today if still today,
        // else Results (so it doesn't get lost above the live cursor).
        if (isToday) today.push(f);
        else results.push(f);
      } else if (isToday) {
        today.push(f);
      } else {
        upcoming.push(f);
      }
    }
    // Today + upcoming: earliest first. Results: most recent first.
    today.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    upcoming.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    results.sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc));
    return { today, upcoming, results };
  }, [fixtures, resultsByExternalId, todayIso, now]);

  const active = buckets[tab];

  return (
    <div>
      <div role="tablist" className="mt-4 flex gap-1 rounded-lg border border-ps-border bg-ps-surface p-1">
        <TabButton id="today" current={tab} onSelect={setTab} count={buckets.today.length}>
          Today
        </TabButton>
        <TabButton id="upcoming" current={tab} onSelect={setTab} count={buckets.upcoming.length}>
          Upcoming
        </TabButton>
        <TabButton id="results" current={tab} onSelect={setTab} count={buckets.results.length}>
          Results
        </TabButton>
      </div>

      <div className="mt-4 space-y-3">
        {active.length === 0 && (
          <p className="rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
            {tab === "today"
              ? "No matches today."
              : tab === "upcoming"
                ? "No upcoming matches."
                : "No results yet."}
          </p>
        )}
        {active.map((f) => (
          <FixtureCard
            key={f.externalId}
            fixture={f}
            result={resultsByExternalId[f.externalId]}
          />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  id,
  current,
  onSelect,
  count,
  children,
}: {
  id: TabId;
  current: TabId;
  onSelect: (id: TabId) => void;
  count: number;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
      className={[
        "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-ps-text text-ps-bg"
          : "text-ps-text-sec hover:text-ps-text",
      ].join(" ")}
    >
      {children}
      <span
        className={[
          "ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 font-mono text-[0.7rem] tabular-nums",
          active ? "bg-ps-bg/20 text-ps-bg" : "bg-ps-border/60 text-ps-text-sec",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function FixtureCard({
  fixture,
  result,
}: {
  fixture: WcFixture;
  result: FixtureResult | undefined;
}) {
  const city = HOST_CITIES[fixture.city as HostCitySlug];
  const kickoff = new Date(fixture.kickoffUtc);

  const cityTime = formatTime(kickoff, city.timezone);
  const cityDate = formatDateShort(kickoff, city.timezone);
  const localTime = formatTime(kickoff, undefined);
  const localTzAbbr = formatTzAbbr(kickoff);
  const sameClock = cityTime === localTime;

  const isFinished = !!result && (result.homeScore !== null || result.winner !== null);

  return (
    <article
      className="overflow-hidden rounded-xl text-white shadow-sm"
      style={{ backgroundColor: city.color }}
    >
      <header className="flex items-center justify-between px-4 pt-3 text-[0.7rem] font-bold uppercase tracking-wide text-white/85">
        <span>
          {fixture.stage === "group"
            ? `Group ${fixture.group} · MD${fixture.matchday}`
            : stageLabel(fixture.stage)}
        </span>
        <span className="text-right">
          <span className="block">{city.name}</span>
          <span className="block text-[0.6rem] font-medium normal-case tracking-normal text-white/50">{city.stadium}</span>
        </span>
      </header>

      <div className="px-4 pb-3 pt-2">
        <h3 className="flex flex-wrap items-center gap-1.5 text-base font-bold text-white">
          <CountryFlag shape="pill" name={fixture.home} size={20} />
          <span>{fixture.home}</span>
          <span className="mx-0.5 text-white/70">v</span>
          <CountryFlag shape="pill" name={fixture.away} size={20} />
          <span>{fixture.away}</span>
        </h3>

        {isFinished && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/15 px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
            {result?.homeScore !== null && result?.awayScore !== null
              ? `${result?.homeScore} – ${result?.awayScore}`
              : (result?.winner ?? "Result")}
            <span
              className={[
                "rounded-full px-1.5 py-px text-[0.65rem] uppercase tracking-wide",
                result?.isFinalised ? "bg-ps-green/90 text-white" : "bg-ps-amber/90 text-white",
              ].join(" ")}
            >
              {result?.isFinalised ? "Final" : "Provisional"}
            </span>
          </div>
        )}

        <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-white/90">
          <div>
            <dt className="font-semibold uppercase tracking-wide text-white/70">In {city.name.split(" ")[0]}</dt>
            <dd className="font-mono tabular-nums">
              {cityTime}
              <span className="ml-1 text-white/70">· {cityDate}</span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-white/70">Your time</dt>
            <dd className="font-mono tabular-nums">
              {sameClock ? "Same" : `${localTime} ${localTzAbbr}`}
            </dd>
          </div>
        </dl>

      </div>
    </article>
  );
}

function stageLabel(stage: WcFixture["stage"]): string {
  switch (stage) {
    case "R32": return "Round of 32";
    case "R16": return "Round of 16";
    case "QF": return "Quarter-final";
    case "SF": return "Semi-final";
    case "3RD": return "Third place";
    case "FINAL": return "Final";
    default: return stage;
  }
}

function formatTime(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function formatDateShort(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function formatTzAbbr(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

function localDateIso(date: Date): string {
  // Browser-local YYYY-MM-DD, matched against fixture kickoff converted to
  // the same local zone. We intentionally use the device's zone, not city tz —
  // "today" means "today where the user is sitting."
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
