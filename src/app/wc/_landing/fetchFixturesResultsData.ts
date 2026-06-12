import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  const resultsByExternalId: Record<string, FixtureResult | undefined> = {};
  const predictionsByExternalId: Record<string, FixturePredictionData> = {};
  let isMember = false;
  let fullPredictions: Prediction[] = [];
  const windowEventsByExternalId: Record<string, WindowEvent> = {};
  const fixtureByEventId = new Map<string, WcFixture>();

  if (competition) {
    const externalIds = WC2026_FIXTURES.map((f) => f.externalId);

    const { data: events } = await supabase
      .from("events")
      .select(
        `id, external_event_id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_data, result_confirmed, round_id,
         event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
      )
      .eq("competition_id", competition.id)
      .in("external_event_id", externalIds);

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
      const homeScore = numOrNull(data.home_score ?? data.homeScore ?? score.home_score ?? score.homeScore);
      const awayScore = numOrNull(data.away_score ?? data.awayScore ?? score.away_score ?? score.awayScore);
      const winner =
        typeof data.winner === "string" && data.winner ? data.winner : null;

      if (homeScore === null && awayScore === null && winner === null) continue;

      const isFinalised =
        !!row.result_confirmed ||
        (!!row.round_id && finalisedRoundIds.has(row.round_id));

      resultsByExternalId[row.external_event_id] = {
        status: row.status,
        homeScore,
        awayScore,
        winner,
        isFinalised,
      };
    }

    // Membership check
    if (user) {
      const { data: membership } = await supabase
        .from("competition_members")
        .select("id")
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .maybeSingle();
      isMember = Boolean(membership);
    }

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
              "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
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
        };
      }
    }
  }

  return {
    fixtures: WC2026_FIXTURES,
    resultsByExternalId,
    predictionsByExternalId,
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
