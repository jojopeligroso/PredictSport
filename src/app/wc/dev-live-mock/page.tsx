"use client";

/**
 * DEV-ONLY MOCK — /wc/dev-live-mock
 *
 * Renders the real <LiveView> with fabricated live data so the live view can
 * be reviewed pixel-for-pixel in a local browser without touching the DB.
 * Stubs window.fetch for /api/events/live-scores and /api/tournament/standings.
 *
 * DO NOT COMMIT. Delete after review.
 */

import { LiveView } from "@/app/wc/home/DashboardSections";
import { WC2026_FIXTURES } from "@/lib/wc/fixtures";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

const MOCK_USER = "mock-user-id";

// ---- Fixtures: tonight's real R32 slots with resolved names (mirrors the
// knockoutFallbackFixture path in fetchDashboardData) ----
const TONIGHT: [string, string][] = [
  ["Argentina", "Cape Verde"],
  ["Colombia", "Ghana"],
];
const todays = WC2026_FIXTURES.filter(
  (f) => f.stage === "R32" && f.kickoffUtc.startsWith("2026-07-03"),
);
const fixtures: WcFixture[] = todays.slice(0, 2).map((f, i) => ({
  ...f,
  home: TONIGHT[i][0],
  away: TONIGHT[i][1],
}));

const now = Date.now();
const events: WindowEvent[] = fixtures.map((f, i) => ({
  id: `mock-evt-${i}`,
  event_name: `${f.home} vs ${f.away}`,
  sport: "soccer",
  start_time: new Date(now - (i === 0 ? 25 : 70) * 60_000).toISOString(),
  lock_time: new Date(now - (i === 0 ? 35 : 80) * 60_000).toISOString(),
  pick_reveal_at: null,
  status: "upcoming",
  result_confirmed: false,
  event_prediction_types: [
    {
      id: `mock-ept-${i}-w`,
      event_id: `mock-evt-${i}`,
      prediction_type: "winner",
      points: 3,
      partial_points: 0,
      config: { options: [f.home, f.away] },
    },
    {
      id: `mock-ept-${i}-s`,
      event_id: `mock-evt-${i}`,
      prediction_type: "exact_score",
      points: 5,
      partial_points: 0,
      config: null,
    },
  ],
}));

const fixtureByEventId = new Map<string, WcFixture>(
  fixtures.map((f, i) => [`mock-evt-${i}`, f]),
);

// Complete pick on event 0 ("Your pick" + gold halo); none on event 1.
const basePred = {
  user_id: MOCK_USER,
  is_correct: null,
  is_partial: false,
  points_awarded: 0,
  note_text: null,
  note_visibility: "private" as const,
  submitted_at: new Date(now - 86_400_000).toISOString(),
  updated_at: new Date(now - 86_400_000).toISOString(),
  confidence_level: null,
};
const predictions: Prediction[] = [
  {
    ...basePred,
    id: "mock-pred-w",
    event_prediction_type_id: "mock-ept-0-w",
    event_id: "mock-evt-0",
    prediction_type: "winner",
    prediction_data: { selection: fixtures[0].home },
  },
  {
    ...basePred,
    id: "mock-pred-s",
    event_prediction_type_id: "mock-ept-0-s",
    event_id: "mock-evt-0",
    prediction_type: "exact_score",
    prediction_data: { home: 2, away: 0 },
  },
];

// ---- Fetch stubs: live scores + standings ----
const MOCK_SCORES = {
  "mock-evt-0": { homeScore: 1, awayScore: 0, status: "34'", fetchedAt: new Date(now).toISOString() },
  "mock-evt-1": { homeScore: 2, awayScore: 1, status: "78'", fetchedAt: new Date(now).toISOString() },
};

const NAMES = [
  "Dara", "Niamh", "Cillian", "Aoife", "Sean", "Roisin", "Padraig",
  "Eoin", "Maeve", "Oisin", "Sinead", "Fionn", "Grainne", "Tadhg", "Clodagh",
];
function makeStandings(offset: number, withElims: boolean) {
  return NAMES.map((name, i) => ({
    rank: i + 1,
    user_id: name === "Eoin" ? MOCK_USER : `mock-u-${i}`,
    display_name: name,
    points: 90 - i * 4 + offset,
    ...(withElims && i > 11 ? { eliminated: true } : {}),
  }));
}
const OVERALL_STANDINGS = makeStandings(0, false);
const FORMAT_STANDINGS = makeStandings(-7, true);

declare global {
  interface Window {
    __liveMockPatched?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__liveMockPatched) {
  window.__liveMockPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.startsWith("/api/events/live-scores")) return json({ scores: MOCK_SCORES });
    if (url.startsWith("/api/tournament/standings")) {
      const cid = new URL(url, window.location.origin).searchParams.get("classificationId");
      return json({ standings: cid === "mock-format" ? FORMAT_STANDINGS : OVERALL_STANDINGS });
    }
    return orig(input, init);
  };
}

export default function DevLiveMockPage() {
  return (
    <LiveView
      competitionId="mock-competition"
      liveEvents={events}
      predictions={predictions}
      fixtureByEventId={fixtureByEventId}
      windowLocked={true}
      currentUserId={MOCK_USER}
      chatEnabled={true}
      isMember={true}
      memberRole="member"
      memberCount={24}
      lastChatMessage={{
        senderName: "Dara",
        senderAvatar: null,
        content: "Big one tonight",
        createdAt: new Date(now - 5 * 60_000).toISOString(),
      }}
      overallClassificationId="mock-overall"
      formatClassificationId="mock-format"
      liveEnabled={true}
      toggle={() => {}}
      showPrompt={false}
      acceptAlwaysOff={() => {}}
      declinePrompt={() => {}}
      currentRoundName="Round of 16"
    />
  );
}
