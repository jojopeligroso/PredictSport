"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bi } from "@/components/ligas/Bi";
import { ScoreInput } from "@/components/ScoreInput";
import { MarginWindowBar } from "@/components/ligas/MarginWindowBar";
import { deriveWinnerFromScore } from "@/lib/score-format";
import {
  potentialPoints,
  windowFromPredictionData,
  windowToPredictionData,
  WINNER_POINTS,
  type MarginWindow,
} from "@/lib/ligas/system-b";

/**
 * LigaPicksClient — System B picks list for a winter-league instance.
 *
 * Each game is up to three stacked calls (see @/lib/ligas/system-b):
 *   1. Winner — +4, the gate. No winner → the rest is locked.
 *   2. Margin — a confidence window (the "sitting bar"), +6/+4/+3/+2 by width.
 *   3. Exact score — doubles the whole game total.
 *
 * Baseball rule: no draw option ever. A tied committed score does NOT set a
 * winner (deriveWinnerFromScore returns null for baseball) — a hint prompts the
 * user to declare the winner explicitly (extra innings).
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

type PredType = "winner" | "margin" | "exact_score";

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
  predictionType: PredType,
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

  // Seed local state from existing predictions.
  const initialWinners: Record<string, string | null> = {};
  const initialWindows: Record<string, MarginWindow | null> = {};
  for (const pred of predictions ?? []) {
    if (pred?.prediction_type === "winner") {
      initialWinners[pred.event_id] =
        typeof pred.prediction_data?.["value"] === "string"
          ? (pred.prediction_data["value"] as string)
          : null;
    }
    if (pred?.prediction_type === "margin") {
      initialWindows[pred.event_id] = windowFromPredictionData(
        pred.prediction_data,
      );
    }
  }

  const [winners, setWinners] =
    useState<Record<string, string | null>>(initialWinners);
  const [windows, setWindows] =
    useState<Record<string, MarginWindow | null>>(initialWindows);
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
      return;
    }

    // Keep the margin call attached to the (possibly new) winning team.
    const win = windows[event.id];
    if (win) {
      await postPrediction(
        competitionId,
        event.id,
        "margin",
        windowToPredictionData(option, win),
      );
    }
  };

  const handleWindowChange = async (event: LigaPicksEvent, win: MarginWindow) => {
    const team = winners[event.id];
    setWindows((prev) => ({ ...prev, [event.id]: win }));
    setErrors((prev) => ({ ...prev, [event.id]: false }));
    if (!team) return; // gate: no winner yet, keep locally until one is chosen
    const ok = await postPrediction(
      competitionId,
      event.id,
      "margin",
      windowToPredictionData(team, win),
    );
    if (!ok) setErrors((prev) => ({ ...prev, [event.id]: true }));
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

    const implied = deriveWinnerFromScore({ home, away }, event.sport, options);
    if (implied) {
      // Not tied: the score implies the winner — mirror the /wc pattern.
      setWinners((prev) => ({ ...prev, [event.id]: implied }));
      setTieHints((prev) => ({ ...prev, [event.id]: false }));
      await postPrediction(competitionId, event.id, "winner", {
        value: implied,
      });
      const win = windows[event.id];
      if (win) {
        await postPrediction(
          competitionId,
          event.id,
          "margin",
          windowToPredictionData(implied, win),
        );
      }
    } else if (home === away) {
      // Tied baseball score: no derived winner — prompt an explicit declaration.
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
        const win = windows[event.id] ?? null;
        const locked = new Date(event.lock_time) <= new Date();
        const existingScore = scorePred(event.id);
        const hasExact = existingScore != null;
        const potential = potentialPoints({
          hasWinner: Boolean(selected),
          window: win,
          hasExact,
        });

        return (
          <article
            key={event.id}
            className="rounded-2xl border border-ps-border bg-ps-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
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
              </div>
              {/* Potential points for this game */}
              <span
                className={[
                  "shrink-0 rounded-lg px-2 py-1 font-mono text-micro font-bold tabular-nums",
                  potential > 0
                    ? "bg-liga/15 text-liga-deep dark:text-liga"
                    : "bg-ps-bg-alt text-ps-text-ter",
                ].join(" ")}
                aria-label="Potential points"
              >
                <Bi es={`hasta ${potential}`} en={`up to ${potential}`} />
              </span>
            </div>

            {/* 1 — Winner (the gate) */}
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

            {/* 2 — Margin window (the sitting bar). Gated on the winner. */}
            <div className="mt-4">
              {selected ? (
                <MarginWindowBar
                  value={win}
                  onChange={(w) => handleWindowChange(event, w)}
                  disabled={locked}
                  teamLabel={selected}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-ps-border px-3 py-3">
                  <p className="text-xs text-ps-text-ter">
                    <Bi
                      es={`Elige un ganador (+${WINNER_POINTS}) para abrir el margen`}
                      en={`Call a winner (+${WINNER_POINTS}) to open the margin`}
                    />
                  </p>
                </div>
              )}
            </div>

            {/* 3 — Exact score (the multiplier). */}
            {scoreEpt && (
              <div className="mt-4">
                <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ps-text-sec">
                  <Bi es="Marcador exacto · ×2" en="Exact score · ×2" />
                </p>
                <div className="mt-2">
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
