import { Bi } from "@/components/ligas/Bi";

/**
 * LigaResults — read-only list of resulted games and how the user's pick did.
 *
 * This is the visible "score" step of the predict → score → rank loop: each
 * finished game shows the final score, the user's winner pick, and whether it
 * scored (✓ +pts / ✗). Points come straight from predictions.points_awarded,
 * which the results automation writes.
 */

interface ResultEpt {
  id: string;
  prediction_type: string;
  points: number;
}

export interface LigaResultEvent {
  id: string;
  event_name: string;
  result_data: Record<string, unknown> | null;
  event_prediction_types: ResultEpt[];
}

export interface LigaResultPrediction {
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown> | null;
  points_awarded: number | null;
  is_correct: boolean | null;
}

/** Pull a { home_team, away_team, home_score, away_score } view from result_data. */
function readScore(result: Record<string, unknown> | null) {
  if (!result) return null;
  const score = (result.score ?? result) as Record<string, unknown>;
  const homeScore = score.home_score ?? score.home;
  const awayScore = score.away_score ?? score.away;
  if (homeScore == null || awayScore == null) return null;
  return {
    homeTeam: (score.home_team as string) ?? "",
    awayTeam: (score.away_team as string) ?? "",
    homeScore: Number(homeScore),
    awayScore: Number(awayScore),
  };
}

function pickValue(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  return (data.value ?? data.winner) as string | null;
}

export function LigaResults({
  events,
  predictions,
}: {
  events: LigaResultEvent[];
  predictions: LigaResultPrediction[];
}) {
  if (events.length === 0) return null;

  const predByEvent = new Map<string, LigaResultPrediction>();
  for (const p of predictions) {
    if (p.prediction_type === "winner") predByEvent.set(p.event_id, p);
  }

  return (
    <section className="mt-8">
      <h2 className="font-liga text-xl font-bold uppercase tracking-tight text-ps-text">
        <Bi es="Resultados" en="Results" />
      </h2>
      <ul className="mt-3 space-y-2">
        {events.map((event) => {
          const score = readScore(event.result_data);
          const pred = predByEvent.get(event.id);
          const pick = pickValue(pred?.prediction_data ?? null);
          const scored = pred?.points_awarded != null && pred.points_awarded > 0;
          const hasPick = pick != null;

          return (
            <li
              key={event.id}
              className="rounded-xl border border-ps-border bg-ps-surface px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ps-text">
                  {score ? (
                    <>
                      {score.homeTeam}{" "}
                      <span className="font-mono tabular-nums text-ps-text">
                        {score.homeScore}–{score.awayScore}
                      </span>{" "}
                      {score.awayTeam}
                    </>
                  ) : (
                    event.event_name
                  )}
                </span>
                {hasPick && (
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.1em] ${
                      scored
                        ? "bg-ps-green-soft text-ps-green"
                        : "bg-ps-red-soft text-ps-red"
                    }`}
                  >
                    {scored ? (
                      <>✓ +{pred?.points_awarded}</>
                    ) : (
                      <Bi es="✗ fallo" en="✗ miss" />
                    )}
                  </span>
                )}
              </div>
              {hasPick && (
                <p className="mt-1 font-mono text-micro text-ps-text-ter">
                  <Bi es="Tu pick:" en="Your pick:" /> {pick}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
