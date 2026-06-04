import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES } from "@/lib/wc/fixtures";
import type { FixtureResult, FixturePredictionData } from "@/components/wc/FixturesTabs";

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

  if (competition) {
    const externalIds = WC2026_FIXTURES.map((f) => f.externalId);

    const { data: events } = await supabase
      .from("events")
      .select(
        "id, external_event_id, status, result_data, result_confirmed, round_id, lock_time, sport",
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
      const homeScore = numOrNull(data.home_score ?? data.homeScore);
      const awayScore = numOrNull(data.away_score ?? data.awayScore);
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
              "event_id, prediction_type, prediction_data, updated_at",
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
