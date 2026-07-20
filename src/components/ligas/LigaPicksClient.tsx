"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bi } from "@/components/ligas/Bi";
import { ScoreInput } from "@/components/ScoreInput";
import { deriveWinnerFromScore } from "@/lib/score-format";

/**
 * LigaPicksClient — interactive picks list for a winter-league instance.
 *
 * Baseball rule: no draw option ever. A tied committed score does NOT set a
 * winner (deriveWinnerFromScore returns null for baseball) — instead a hint
 * prompts the user to declare the winner explicitly (extra innings).
 */

export interface LigaPicksEpt {
  id: string;
  event_id: string;
  prediction_type: string;
  points: number;
  partial_points: number;
  config: Record<string, unknown> | null;
}

export interface LigaPicksEvent {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  status: string;
  event_prediction_types: LigaPicksEpt[];
}

export interface LigaPicksPrediction {
  id: string;
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

interface LigaPicksClientProps {
  competitionId: string;
  instanceMember: boolean;
  events: LigaPicksEvent[];
  predictions: LigaPicksPrediction[];
  seasonStartEs: string;
  seasonStartEn: string;
}

/** Winner options from the winner EPT config; fallback: parse "A vs B". Never includes "Draw". */
function winnerOptions(event: LigaPicksEvent): string[] {
  const winnerEpt = (event.event_prediction_types ?? []).find(
    (ept) => ept?.prediction_type === "winner",
  );
  const configOptions = (winnerEpt?.config?.["options"] ?? []) as unknown;
  const fromConfig = Array.isArray(configOptions)
    ? configOptions.filter((o): o is string => typeof o === "string")
    : [];
  const options =
    fromConfig.length >= 2
      ? fromConfig
      : (event.event_name ?? "").split(" vs ").map((s) => s.trim());
  // Baseball: never offer a draw
  return options.filter((o) => o !== "Draw");
}

async function postPrediction(
  competitionId: string,
  eventId: string,
  predictionType: "winner" | "exact_score",
  predictionData: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        competition_id: competitionId,
        prediction_type: predictionType,
        prediction_data: predictionData,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function LigaPicksClient({
  competitionId,
  instanceMember,
  events,
  predictions,
  seasonStartEs,
  seasonStartEn,
}: LigaPicksClientProps) {
  const router = useRouter();

  // Seed local winner state from existing predictions
  const initialWinners: Record<string, string | null> = {};
  for (const pred of predictions ?? []) {
    if (pred?.prediction_type === "winner") {
      initialWinners[pred.event_id] =
        typeof pred.prediction_data?.["value"] === "string"
          ? (pred.prediction_data["value"] as string)
          : null;
    }
  }

  const [winners, setWinners] =
    useState<Record<string, string | null>>(initialWinners);
  const [tieHints, setTieHints] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);

  // ── Not a member: join card ──────────────────────────────────────────
  if (!instanceMember) {
    const handleJoin = async () => {
      setJoining(true);
      setJoinError(false);
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitionId }),
        });
        if (!res.ok) {
          setJoinError(true);
          setJoining(false);
          return;
        }
        router.refresh();
      } catch {
        setJoinError(true);
        setJoining(false);
      }
    };

    return (
      <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining}
          className="block w-full rounded-xl bg-liga px-4 py-3 text-center font-display text-sm font-extrabold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
        >
          <Bi es="Unirme a la competencia" en="Join the competition" />
        </button>
        {joinError && (
          <p className="mt-2 text-sm font-semibold text-ps-red">
            <Bi
              es="No se pudo completar. Intenta de nuevo."
              en="Something went wrong. Try again."
            />
          </p>
        )}
      </section>
    );
  }

  // ── Member, no events yet: pre-season empty state ────────────────────
  if ((events ?? []).length === 0) {
    return (
      <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <p className="text-sm font-semibold text-ps-text-sec">
          <Bi es={seasonStartEs} en={seasonStartEn} />
        </p>
      </section>
    );
  }

  // ── Event cards ──────────────────────────────────────────────────────
  const scorePred = (eventId: string): Record<string, unknown> | null => {
    const pred = (predictions ?? []).find(
      (p) => p?.event_id === eventId && p?.prediction_type === "exact_score",
    );
    return pred?.prediction_data ?? null;
  };

  const handleWinnerTap = async (event: LigaPicksEvent, option: string) => {
    const previous = winners[event.id] ?? null;
    setWinners((prev) => ({ ...prev, [event.id]: option }));
    setTieHints((prev) => ({ ...prev, [event.id]: false }));
    setErrors((prev) => ({ ...prev, [event.id]: false }));

    const ok = await postPrediction(competitionId, event.id, "winner", {
      value: option,
    });
    if (!ok) {
      setWinners((prev) => ({ ...prev, [event.id]: previous }));
      setErrors((prev) => ({ ...prev, [event.id]: true }));
    }
  };

  const handleScoreCommit = async (
    event: LigaPicksEvent,
    options: string[],
    home: number,
    away: number,
  ) => {
    setErrors((prev) => ({ ...prev, [event.id]: false }));

    const ok = await postPrediction(competitionId, event.id, "exact_score", {
      home,
      away,
    });
    if (!ok) {
      setErrors((prev) => ({ ...prev, [event.id]: true }));
      return;
    }

    const implied = deriveWinnerFromScore(
      { home, away },
      event.sport,
      options,
    );
    if (implied) {
      // Not tied: mirror the /wc pattern — score implies the winner
      setWinners((prev) => ({ ...prev, [event.id]: implied }));
      setTieHints((prev) => ({ ...prev, [event.id]: false }));
    } else if (home === away) {
      // Tied baseball score: no derived winner — prompt an explicit declaration
      setTieHints((prev) => ({ ...prev, [event.id]: true }));
    }
  };

  return (
    <section className="mt-5 space-y-3">
      {(events ?? []).map((event) => {
        const options = winnerOptions(event);
        const homeName = options[0] ?? "";
        const awayName = options[options.length - 1] ?? "";
        const scoreEpt = (event.event_prediction_types ?? []).find(
          (ept) => ept?.prediction_type === "exact_score",
        );
        const selected = winners[event.id] ?? null;
        const locked = new Date(event.lock_time) <= new Date();
        const existingScore = scorePred(event.id);

        return (
          <article
            key={event.id}
            className="rounded-2xl border border-ps-border bg-ps-surface p-4"
          >
            <p className="text-sm font-semibold text-ps-text">
              {homeName}
              <span className="text-ps-text-ter"> vs </span>
              {awayName}
            </p>
            <p className="mt-0.5 font-mono text-micro text-ps-text-ter">
              <Bi
                es={new Date(event.start_time).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                en={new Date(event.start_time).toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[homeName, awayName].map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={locked}
                  onClick={() => handleWinnerTap(event, option)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none ${
                    selected === option
                      ? "bg-liga text-white"
                      : "bg-ps-bg-alt text-ps-text"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {scoreEpt && (
              <div className="mt-3">
                <ScoreInput
                  homeLabel={homeName}
                  awayLabel={awayName}
                  initialHome={
                    existingScore?.["home"] != null
                      ? String(existingScore["home"])
                      : undefined
                  }
                  initialAway={
                    existingScore?.["away"] != null
                      ? String(existingScore["away"])
                      : undefined
                  }
                  onCommit={(home, away) =>
                    handleScoreCommit(event, options, home, away)
                  }
                  disabled={locked}
                  variant="card"
                />
              </div>
            )}

            {tieHints[event.id] && (
              <p className="mt-2 text-sm font-semibold text-liga-deep dark:text-liga">
                <Bi
                  es="Empate en 9 — declara el ganador (extra innings)"
                  en="Tied after 9 — declare the winner (extra innings)"
                />
              </p>
            )}

            {errors[event.id] && (
              <p className="mt-2 text-sm font-semibold text-ps-red">
                <Bi
                  es="No se pudo guardar. Intenta de nuevo."
                  en="Couldn't save. Try again."
                />
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
