"use client";

import Link from "next/link";
import {
  SportBar,
  SportPill,
  PointsStamp,
  SendToThread,
  SPORT_CONFIG,
  type SportKey,
  toSportKey,
} from "@/components/ui";
import { getVerdict } from "@/lib/payoff-copy";
import { psDefaultResultCopy } from "@/lib/whatsapp";
import type { Event, Prediction } from "@/types/database";

function getResultState(prediction: Prediction): "correct" | "wrong" | "partial" {
  if (prediction.is_correct === true) return "correct";
  if (prediction.is_partial) return "partial";
  return "wrong";
}

function formatResultDisplay(resultData: Record<string, unknown> | null): string {
  if (!resultData) return "Result pending";
  if (resultData.winner) return String(resultData.winner);
  if (resultData.score) {
    const s = resultData.score as Record<string, unknown>;
    return `${s.home_team ?? ""} ${s.home_score ?? 0}–${s.away_score ?? 0} ${s.away_team ?? ""}`;
  }
  if (resultData.answer) return String(resultData.answer);
  return "Result recorded";
}

function formatPickValue(data: Record<string, unknown>): string {
  if (data?.value !== undefined) return String(data.value);
  if (data?.selection !== undefined) return String(data.selection);
  if (data?.winner) return String(data.winner);
  return "—";
}

interface ResultCardProps {
  event: Event;
  prediction: Prediction;
  showResultHints?: boolean;
}

export function ResultCard({ event, prediction, showResultHints = true }: ResultCardProps) {
  const sportKey = toSportKey(event.sport);
  const state = getResultState(prediction);
  const verdict = getVerdict(state, event.event_name);
  const resultDisplay = formatResultDisplay(event.result_data);
  const pickDisplay = formatPickValue(prediction.prediction_data);

  const stateColors = showResultHints
    ? {
        correct: { fg: "var(--ps-green)", bg: "var(--ps-green-soft)", label: "CORRECT", icon: "✓" },
        wrong: { fg: "var(--ps-red)", bg: "var(--ps-red-soft)", label: "WRONG", icon: "✕" },
        partial: { fg: "var(--ps-amber-deep)", bg: "var(--ps-amber-soft)", label: "PARTIAL", icon: "●" },
      }[state]
    : { fg: "var(--ps-text-sec)", bg: "rgba(40,30,20,0.06)", label: state.toUpperCase(), icon: "●" };

  return (
    <Link href={`/predictions/${event.id}`}>
      <div
        className="overflow-hidden rounded-[14px] border border-ps-border bg-ps-surface"
        style={{ boxShadow: "0 1px 2px rgba(40,30,20,0.04)" }}
      >
        <SportBar sport={sportKey} height={3} />
        <div className="p-3">
          {/* Row 1: SportPill + PointsStamp */}
          <div className="flex items-center justify-between mb-2">
            <SportPill sport={sportKey} size="sm" />
            <PointsStamp earned={prediction.points_awarded} max={10} state={state} />
          </div>

          {/* Title */}
          <h4 className="text-base font-extrabold leading-snug text-ps-text">
            {event.event_name}
          </h4>
          <p className="mt-0.5 text-[11px] font-medium text-ps-text-sec">
            {new Date(event.start_time).toLocaleDateString("en-IE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>

          {/* Result strip */}
          <div
            className="mt-2.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
            style={{ background: "rgba(40,30,20,0.04)" }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: stateColors.fg }}
            >
              <span className="text-sm font-bold">{stateColors.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="leading-none"
                style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: stateColors.fg }}
              >
                {stateColors.label}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-ps-text">
                <span className="font-medium text-ps-text-sec">You:</span> {pickDisplay}
                <span className="mx-1.5 text-ps-text-ter">&middot;</span>
                <span className="font-medium text-ps-text-sec">Result:</span> {resultDisplay}
              </p>
            </div>
          </div>

          {/* Verdict quip */}
          <p className="mt-2.5 text-[12.5px] italic leading-relaxed text-ps-text">
            &ldquo;{verdict}&rdquo;
          </p>

          {/* SendToThread */}
          <div className="mt-2.5 flex justify-end" onClick={(e) => e.preventDefault()}>
            <SendToThread
              variant="inline"
              defaultText={psDefaultResultCopy({ eventName: event.event_name, state })}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
