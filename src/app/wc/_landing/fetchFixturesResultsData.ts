import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { fixtureFilter } from "@/lib/tournament/shared-fixtures";
import type { FixtureResult, FixturePredictionData } from "@/components/wc/FixturesTabs";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction, EventPredictionType } from "@/types/database";

/**
 * Fetch fixture results and user prediction context for the WC fixtures/results tabs.
 *
 * Shared by /wc (hub tabs) and /wc/results (legacy redirect fallback).
 * Returns static fixture list + live results + per-fixture prediction context.
 */
export async function fetchFixturesResultsData() {
  const { competition, user, isMember: resolvedIsMember } = await resolveWcCompetition();

  const supabase = await createClient();

  const resultsByExternalId: Record<string, FixtureResult | undefined> = {};
  const predictionsByExternalId: Record<string, FixturePredictionData> = {};
  const nameOverrides: Record<string, { home: string; away: string }> = {};
  let isMember = false;
  let fullPredictions: Prediction[] = [];
  const windowEventsByExternalId: Record<string, WindowEvent> = {};
  const fixtureByEventId = new Map<string, WcFixture>();

  // Stage prefixes for knockout events created via admin (different ID scheme
  // than the static catalogue). We query both so the merge picks up real team
  // names, confirmed times, and prediction/result linkage.
  const KO_STAGE_PREFIXES = ["r32", "r16", "qf", "sf", "3rd", "final"] as const;
  type KoStagePrefix = (typeof KO_STAGE_PREFIXES)[number];
  const KO_PREFIX_TO_STAGE: Record<KoStagePrefix, WcFixture["stage"]> = {
    r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3RD", final: "FINAL",
  };

  if (competition) {
    const externalIds = WC2026_FIXTURES.map((f) => f.externalId);
    const ff = fixtureFilter(competition);

    const eventFields = `id, external_event_id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_data, result_confirmed, round_id,
         event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`;

    // Query 1: events matching static fixture catalogue IDs (group stage)
    const { data: catalogueEvents } = await supabase
      .from("events")
      .select(eventFields)
      .eq(ff.key, ff.value)
      .in("external_event_id", externalIds);

    // Query 2: knockout events using admin-created IDs (manual:wc2026-r32-*, etc.)
    const koPatterns = KO_STAGE_PREFIXES.map((p) => `manual:wc2026-${p}-%`);
    const { data: knockoutEvents } = await supabase
      .from("events")
      .select(eventFields)
      .eq(ff.key, ff.value)
      .or(koPatterns.map((p) => `external_event_id.like.${p}`).join(","));

    // Merge — deduplicate by external_event_id
    const seenIds = new Set<string>();
    const events: typeof catalogueEvents = [];
    for (const e of [...(catalogueEvents ?? []), ...(knockoutEvents ?? [])]) {
      const eid = (e as { external_event_id: string }).external_event_id;
      if (eid && !seenIds.has(eid)) {
        seenIds.add(eid);
        events.push(e);
      }
    }

    const roundIds = [
      ...new Set(
        (events ?? [])
          .map((e: { round_id: string | null }) => e.round_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const { data: rounds } = roundIds.length
      ? await supabase.from("rounds").select("id, status").in("id", roundIds)
      : { data: [] as { id: string; status: string }[] };

    const finalisedRoundIds = new Set(
      (rounds ?? [])
        .filter((r: { status: string }) => r.status === "scored")
        .map((r: { id: string }) => r.id),
    );

    for (const e of events ?? []) {
      const row = e as {
        external_event_id: string;
        status: string;
        result_data: Record<string, unknown> | null;
        result_confirmed: boolean | null;
        round_id: string | null;
      };
      if (!row.external_event_id) continue;
      const data = row.result_data ?? {};
      const score = (typeof data.score === "object" && data.score !== null ? data.score : {}) as Record<string, unknown>;
      const homeScore = numOrNull(data.home_score ?? data.homeScore ?? score.home_score ?? score.homeScore ?? score.home);
      const awayScore = numOrNull(data.away_score ?? data.awayScore ?? score.away_score ?? score.awayScore ?? score.away);
      const winner =
        typeof data.winner === "string" && data.winner ? data.winner : null;

      if (homeScore === null && awayScore === null && winner === null) continue;

      const isFinalised =
        !!row.result_confirmed ||
        (!!row.round_id && finalisedRoundIds.has(row.round_id));

      // Extract penalty shootout scores from result_data.score.periods.penalties
      const periods = (typeof score.periods === "object" && score.periods !== null ? score.periods : {}) as Record<string, { home?: number; away?: number }>;
      const penalties = periods.penalties;
      const penaltyHome = numOrNull(penalties?.home ?? null);
      const penaltyAway = numOrNull(penalties?.away ?? null);

      resultsByExternalId[row.external_event_id] = {
        status: row.status,
        homeScore,
        awayScore,
        winner,
        isFinalised,
        penaltyHome,
        penaltyAway,
      };
    }

    isMember = resolvedIsMember;

    // Build WindowEvent objects for expand-to-pick
    const fixtureByExternalId = new Map<string, WcFixture>();
    for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

    for (const e of events ?? []) {
      const row = e as {
        id: string;
        external_event_id: string;
        event_name: string;
        sport: string;
        start_time: string;
        lock_time: string;
        status: string;
        result_confirmed: boolean;
        event_prediction_types: EventPredictionType[];
      };
      if (!row.external_event_id || !row.id) continue;
      windowEventsByExternalId[row.external_event_id] = {
        id: row.id,
        event_name: row.event_name,
        sport: row.sport,
        start_time: row.start_time,
        lock_time: row.lock_time,
        status: row.status,
        result_confirmed: row.result_confirmed ?? false,
        event_prediction_types: row.event_prediction_types ?? [],
      };
      const fixture = fixtureByExternalId.get(row.external_event_id);
      if (fixture) fixtureByEventId.set(row.id, fixture);

      // Build name overrides for knockout fixtures whose DB event_name has
      // resolved team names (e.g. "Mexico vs Canada" instead of "Winner A vs Runner-up B")
      if (fixture && fixture.stage !== "group" && row.event_name) {
        const parts = row.event_name.split(/\s+vs?\s+/i);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          const home = parts[0].trim();
          const away = parts[1].trim();
          // Only override if the DB name differs from the static placeholder
          if (home !== fixture.home || away !== fixture.away) {
            nameOverrides[row.external_event_id] = { home, away };
          }
        }
      }
    }

    // Prediction context — only for authenticated users
    if (user) {
      const eventIds = (events ?? [])
        .map((e: { id: string }) => e.id)
        .filter(Boolean);

      const { data: epts } = eventIds.length
        ? await supabase
            .from("event_prediction_types")
            .select("event_id, prediction_type, config")
            .in("event_id", eventIds)
        : {
            data: [] as {
              event_id: string;
              prediction_type: string;
              config: Record<string, unknown> | null;
            }[],
          };

      const { data: userPreds } = eventIds.length
        ? await supabase
            .from("predictions")
            .select(
              "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at, confidence_level",
            )
            .eq("user_id", user.id)
            .in("event_id", eventIds)
            .order("updated_at", { ascending: false })
        : {
            data: [] as {
              event_id: string;
              prediction_type: string;
              prediction_data: Record<string, unknown>;
              updated_at: string;
            }[],
          };

      fullPredictions = (userPreds ?? []) as Prediction[];

      for (const e of events ?? []) {
        const row = e as {
          id: string;
          external_event_id: string;
          lock_time: string;
          sport: string;
          status: string;
        };
        if (!row.external_event_id || !row.id) continue;

        const eventEpts = (epts ?? []).filter(
          (ep: { event_id: string }) => ep.event_id === row.id,
        );
        const winnerEpt = eventEpts.find(
          (ep: { prediction_type: string }) =>
            ep.prediction_type === "winner",
        );
        const scoreEpt = eventEpts.find(
          (ep: { prediction_type: string }) =>
            ep.prediction_type === "exact_score",
        );

        const eventPreds = (userPreds ?? []).filter(
          (p: { event_id: string }) => p.event_id === row.id,
        );
        const winnerPred = eventPreds.find(
          (p: { prediction_type: string }) =>
            p.prediction_type === "winner",
        );
        const scorePred = eventPreds.find(
          (p: { prediction_type: string }) =>
            p.prediction_type === "exact_score",
        );

        const currentWinner: string | null =
          (winnerPred?.prediction_data?.value as string) ??
          (winnerPred?.prediction_data?.selection as string) ??
          null;

        let currentScore: { home: number; away: number } | null = null;
        if (scorePred?.prediction_data) {
          const sd = scorePred.prediction_data;
          const h = Number(sd.home ?? sd.home_score);
          const a = Number(sd.away ?? sd.away_score);
          if (!isNaN(h) && !isNaN(a)) currentScore = { home: h, away: a };
        }

        const winnerOptions =
          (winnerEpt?.config?.options as string[]) ?? [];

        predictionsByExternalId[row.external_event_id] = {
          eventId: row.id,
          competitionId: competition.id,
          sport: row.sport ?? "soccer",
          lockTime: row.lock_time,
          eventStatus: row.status,
          winnerOptions,
          hasExactScore: !!scoreEpt,
          currentWinner,
          currentScore,
          winnerCorrect: winnerPred ? ((winnerPred as { is_correct?: boolean | null }).is_correct ?? null) : null,
          scoreCorrect: scorePred ? ((scorePred as { is_correct?: boolean | null }).is_correct ?? null) : null,
          winnerPoints: (winnerPred as { points_awarded?: number })?.points_awarded ?? 0,
          scorePoints: (scorePred as { points_awarded?: number })?.points_awarded ?? 0,
          userConfidence: (winnerPred as { confidence_level?: number | null })?.confidence_level ?? null,
        };
      }
    }
  }

  // ── Merge knockout fixtures from DB into the static catalogue ──────────
  // The static catalogue has placeholder names/times for knockout slots.
  // When real DB events exist (created by admin after bracket resolves),
  // we replace the static entries with merged fixtures that carry the DB's
  // external_event_id, team names, and confirmed kickoff times, but keep
  // the static fixture's city/stadium and stage metadata.
  //
  // Matching: within each stage, sort both static and DB by kickoff time
  // and pair by position (both lists have the same count per stage).
  const dbKoEvents: { eid: string; name: string; start: string; stage: WcFixture["stage"] }[] = [];
  for (const eid of Object.keys(windowEventsByExternalId)) {
    for (const prefix of KO_STAGE_PREFIXES) {
      if (eid.startsWith(`manual:wc2026-${prefix}-`)) {
        const we = windowEventsByExternalId[eid];
        dbKoEvents.push({
          eid,
          name: we.event_name,
          start: we.start_time,
          stage: KO_PREFIX_TO_STAGE[prefix],
        });
        break;
      }
    }
  }

  let mergedFixtures = WC2026_FIXTURES;
  if (dbKoEvents.length > 0) {
    // Group DB events by stage
    const dbByStage = new Map<WcFixture["stage"], typeof dbKoEvents>();
    for (const e of dbKoEvents) {
      const arr = dbByStage.get(e.stage) ?? [];
      arr.push(e);
      dbByStage.set(e.stage, arr);
    }

    // For each stage with DB events, pair with static fixtures by chrono order
    const replacements = new Map<number, WcFixture>(); // index in WC2026_FIXTURES → replacement
    for (const [stage, dbEvents] of dbByStage) {
      const staticIndices = WC2026_FIXTURES
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => f.stage === stage)
        .sort((a, b) => a.f.kickoffUtc.localeCompare(b.f.kickoffUtc));
      const sortedDb = [...dbEvents].sort((a, b) => a.start.localeCompare(b.start));

      const count = Math.min(staticIndices.length, sortedDb.length);
      for (let j = 0; j < count; j++) {
        const sf = staticIndices[j];
        const db = sortedDb[j];
        const parts = db.name.split(/\s+vs?\s+/i);
        const home = parts[0]?.trim() ?? sf.f.home;
        const away = parts[1]?.trim() ?? sf.f.away;
        replacements.set(sf.i, {
          ...sf.f,
          externalId: db.eid,
          home,
          away,
          kickoffUtc: new Date(db.start).toISOString(),
          kickoffConfirmed: true,
        });
      }
    }

    if (replacements.size > 0) {
      mergedFixtures = WC2026_FIXTURES.map((f, i) => replacements.get(i) ?? f);
    }
  }

  return {
    fixtures: mergedFixtures,
    resultsByExternalId,
    predictionsByExternalId,
    nameOverrides,
    serverDateIso: new Date().toISOString().slice(0, 10),
    windowEventsByExternalId,
    fixtureByEventId,
    fullPredictions,
    competitionId: competition?.id ?? null,
    isMember,
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
