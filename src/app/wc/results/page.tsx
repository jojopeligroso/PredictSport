import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WC2026_FIXTURES } from "@/lib/wc/fixtures";
import { FixturesTabs, type FixtureResult } from "./FixturesTabs";
import type { FixturePredictionData } from "./FixturesTabs";

export const dynamic = "force-dynamic";
// Keep the page fresh — provider results land via /api/sports/fetch-result;
// a 60s revalidation pulls in finalised scores without a manual refresh.
export const revalidate = 60;

/**
 * /wc/results — Three tabs over the full 104-match fixture list:
 *   • Today     — fixtures kicking off in the user's local "today"
 *   • Upcoming  — future fixtures
 *   • Results   — fixtures with confirmed/provisional results
 *
 * Fixture data lives in `src/lib/wc/fixtures.ts` (group stage + knockout
 * placeholders). Results are joined in from the `events` table keyed by
 * `external_event_id`.
 */
export default async function ResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/results");
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  // Even with no competition we still show the static fixture list.
  const resultsByExternalId: Record<string, FixtureResult | undefined> = {};
  let predictionsByExternalId: Record<string, FixturePredictionData> = {};

  if (competition) {
    const externalIds = WC2026_FIXTURES.map((f) => f.externalId);

    const { data: events } = await supabase
      .from("events")
      .select("id, external_event_id, status, result_data, result_confirmed, round_id, lock_time, sport")
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

      // Only include rows that actually carry a result.
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

    // --- Prediction context for inline predictions ---

    // Get event IDs for EPT + prediction queries
    const eventIds = (events ?? []).map((e: any) => e.id as string).filter(Boolean);

    // Event prediction types
    const { data: epts } = eventIds.length
      ? await supabase
          .from("event_prediction_types")
          .select("event_id, prediction_type, config")
          .in("event_id", eventIds)
      : { data: [] as { event_id: string; prediction_type: string; config: Record<string, unknown> | null }[] };

    // User's existing predictions
    const { data: userPreds } = eventIds.length
      ? await supabase
          .from("predictions")
          .select("event_id, prediction_type, prediction_data, updated_at")
          .eq("user_id", user.id)
          .in("event_id", eventIds)
          .order("updated_at", { ascending: false })
      : { data: [] as { event_id: string; prediction_type: string; prediction_data: Record<string, unknown>; updated_at: string }[] };

    // Build prediction context map keyed by external_event_id
    for (const e of events ?? []) {
      const row = e as {
        id: string;
        external_event_id: string;
        lock_time: string;
        sport: string;
        status: string;
      };
      if (!row.external_event_id || !row.id) continue;

      const eventEpts = (epts ?? []).filter((ep: any) => ep.event_id === row.id);
      const winnerEpt = eventEpts.find((ep: any) => ep.prediction_type === "winner");
      const scoreEpt = eventEpts.find((ep: any) => ep.prediction_type === "exact_score");

      // Take most recent prediction per type (query is ordered by updated_at desc)
      const eventPreds = (userPreds ?? []).filter((p: any) => p.event_id === row.id);
      const winnerPred = eventPreds.find((p: any) => p.prediction_type === "winner");
      const scorePred = eventPreds.find((p: any) => p.prediction_type === "exact_score");

      // Normalize winner value — bracket wizard uses {selection}, picks page uses {value}
      const currentWinner: string | null =
        (winnerPred?.prediction_data?.value as string) ??
        (winnerPred?.prediction_data?.selection as string) ??
        null;

      // Normalize score — might be {home, away} or {home_score, away_score}
      let currentScore: { home: number; away: number } | null = null;
      if (scorePred?.prediction_data) {
        const sd = scorePred.prediction_data;
        const h = Number(sd.home ?? sd.home_score);
        const a = Number(sd.away ?? sd.away_score);
        if (!isNaN(h) && !isNaN(a)) currentScore = { home: h, away: a };
      }

      const winnerOptions = (winnerEpt?.config?.options as string[]) ?? [];

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

  const serverDateIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">
        Fixtures &amp; Results
      </h1>
      <p className="mt-1 text-sm text-ps-text-sec">
        All 104 matches. Times shown in the host city&apos;s local zone and yours.
      </p>

      <FixturesTabs
        fixtures={WC2026_FIXTURES}
        resultsByExternalId={resultsByExternalId}
        serverDateIso={serverDateIso}
        predictionsByExternalId={predictionsByExternalId}
      />
    </div>
  );
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
