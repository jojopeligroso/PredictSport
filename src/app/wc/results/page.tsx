import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /results — Results page with provisional/final labels.
 */
export default async function ResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/results");
  }

  // Find WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">No competition found</h1>
      </div>
    );
  }

  // Get resulted events
  const { data: events } = await supabase
    .from("events")
    .select("id, event_name, start_time, status, result_data, result_confirmed, round_id")
    .eq("competition_id", competition.id)
    .in("status", ["resulted", "locked"])
    .order("start_time", { ascending: false })
    .limit(50);

  // Check which rounds are finalised
  const roundIds = [...new Set((events ?? []).map((e: { round_id: string | null }) => e.round_id).filter(Boolean))];
  const { data: rounds } = roundIds.length > 0
    ? await supabase
        .from("rounds")
        .select("id, name, status")
        .in("id", roundIds as string[])
    : { data: [] };

  const roundMap = new Map(
    (rounds ?? []).map((r: { id: string; name: string; status: string }) => [r.id, r])
  );

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">Results</h1>

      <div className="mt-6 space-y-3">
        {(events ?? []).map((event: {
          id: string;
          event_name: string;
          start_time: string;
          status: string;
          result_data: Record<string, unknown> | null;
          result_confirmed: boolean;
          round_id: string | null;
        }) => {
          const round = event.round_id ? roundMap.get(event.round_id) : null;
          const isFinalised = round?.status === "scored";

          return (
            <div
              key={event.id}
              className="rounded-xl border border-ps-border bg-ps-surface p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ps-text">{event.event_name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
                    {new Date(event.start_time).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isFinalised
                      ? "bg-ps-green/15 text-ps-green"
                      : "bg-ps-amber/15 text-ps-amber"
                  }`}
                >
                  {isFinalised ? "Final" : "Provisional"}
                </span>
              </div>

              {event.result_data && (
                <div className="mt-2 rounded-lg bg-ps-bg px-3 py-2">
                  <p className="font-mono text-sm font-semibold text-ps-text">
                    {formatResult(event.result_data)}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {(!events || events.length === 0) && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            No results yet. Check back after the first matches.
          </p>
        )}
      </div>
    </div>
  );
}

function formatResult(data: Record<string, unknown>): string {
  const winner = data.winner as string | undefined;
  const homeScore = data.home_score ?? data.homeScore;
  const awayScore = data.away_score ?? data.awayScore;

  if (homeScore !== undefined && awayScore !== undefined) {
    return `${homeScore} - ${awayScore}${winner ? ` (${winner})` : ""}`;
  }
  if (winner) return winner;
  return "Result pending";
}
