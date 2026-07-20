"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * HundredPicksClient — interactive picks list for a Hundred instance.
 *
 * Winner-only (2 pts, two options, never a draw — super over decides).
 * English only. Derived from LigaPicksClient minus score entry and i18n.
 */

export interface HundredPicksEpt {
  id: string;
  event_id: string;
  prediction_type: string;
  points: number;
  partial_points: number;
  config: Record<string, unknown> | null;
}

export interface HundredPicksEvent {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  status: string;
  event_prediction_types: HundredPicksEpt[];
}

export interface HundredPicksPrediction {
  id: string;
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

interface HundredPicksClientProps {
  competitionId: string;
  instanceMember: boolean;
  events: HundredPicksEvent[];
  predictions: HundredPicksPrediction[];
  seasonStart: string;
}

/** Winner options from the winner EPT config; fallback: parse "A v B". */
function winnerOptions(event: HundredPicksEvent): string[] {
  const winnerEpt = (event.event_prediction_types ?? []).find(
    (ept) => ept?.prediction_type === "winner",
  );
  const configOptions = (winnerEpt?.config?.["options"] ?? []) as unknown;
  const fromConfig = Array.isArray(configOptions)
    ? configOptions.filter((o): o is string => typeof o === "string")
    : [];
  return fromConfig.length >= 2
    ? fromConfig
    : (event.event_name ?? "").split(" v ").map((s) => s.trim());
}

async function postPrediction(
  competitionId: string,
  eventId: string,
  predictionData: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        competition_id: competitionId,
        prediction_type: "winner",
        prediction_data: predictionData,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function HundredPicksClient({
  competitionId,
  instanceMember,
  events,
  predictions,
  seasonStart,
}: HundredPicksClientProps) {
  const router = useRouter();

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
          Join the competition
        </button>
        {joinError && (
          <p className="mt-2 text-sm font-semibold text-ps-red">
            Something went wrong. Try again.
          </p>
        )}
      </section>
    );
  }

  // ── Member, no events yet: pre-season empty state ────────────────────
  if ((events ?? []).length === 0) {
    return (
      <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <p className="text-sm font-semibold text-ps-text-sec">{seasonStart}</p>
      </section>
    );
  }

  // ── Event cards ──────────────────────────────────────────────────────
  const handleWinnerTap = async (event: HundredPicksEvent, option: string) => {
    const previous = winners[event.id] ?? null;
    setWinners((prev) => ({ ...prev, [event.id]: option }));
    setErrors((prev) => ({ ...prev, [event.id]: false }));

    const ok = await postPrediction(competitionId, event.id, { value: option });
    if (!ok) {
      setWinners((prev) => ({ ...prev, [event.id]: previous }));
      setErrors((prev) => ({ ...prev, [event.id]: true }));
    }
  };

  return (
    <section className="mt-5 space-y-3">
      {(events ?? []).map((event) => {
        const options = winnerOptions(event);
        const homeName = options[0] ?? "";
        const awayName = options[options.length - 1] ?? "";
        const selected = winners[event.id] ?? null;
        const locked = new Date(event.lock_time) <= new Date();

        return (
          <article
            key={event.id}
            className="rounded-2xl border border-ps-border bg-ps-surface p-4"
          >
            <p className="text-sm font-semibold text-ps-text">
              {homeName}
              <span className="text-ps-text-ter"> v </span>
              {awayName}
            </p>
            <p className="mt-0.5 font-mono text-micro text-ps-text-ter">
              {new Date(event.start_time).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
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

            {errors[event.id] && (
              <p className="mt-2 text-sm font-semibold text-ps-red">
                Couldn&apos;t save. Try again.
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
