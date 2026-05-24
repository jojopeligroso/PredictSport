"use client";

import Link from "next/link";

interface PredictionWindow {
  id: string;
  name: string;
  round_number: number;
  status: string;
  deadline: string | null;
  sporting_stage_id: string | null;
  prediction_window_number: number | null;
  eventCount: number;
  earliestLock: string | null;
  allResulted: boolean;
  /** Distinct events in this round with a saved `winner` prediction. */
  userPredictionCount: number;
  /** Distinct events in this round with a saved `exact_score` tiebreaker. */
  userScoreCount: number;
  /** How many events in this round have an `exact_score` EPT (knockout rounds = 0). */
  scoreEligibleCount: number;
}

export function PredictionWindowSelector({
  windows,
  competitionId: _competitionId,
  basePath = "/wc/picks",
}: {
  windows: PredictionWindow[];
  competitionId: string;
  basePath?: string;
}) {
  if (windows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No prediction windows available yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {windows.map((w) => {
        const isOpen = w.status === "open";
        const isLocked = w.status === "locked";
        const isScored = w.status === "scored";
        const lockDate = w.earliestLock ? new Date(w.earliestLock) : null;
        const isOverdue = lockDate ? lockDate <= new Date() : false;

        return (
          <Link
            key={w.id}
            href={`${basePath}/${w.id}`}
            className="block rounded-xl border border-ps-border bg-ps-surface p-4 transition-all hover:border-ps-text/20 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-ps-text">{w.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
                  {w.eventCount} {w.eventCount === 1 ? "fixture" : "fixtures"}
                </p>
              </div>
              <StatusChip
                isOpen={isOpen}
                isLocked={isLocked}
                isScored={isScored}
              />
            </div>

            {/* Lock countdown */}
            <div className="mt-3 flex items-center justify-between">
              {isOpen && lockDate && !isOverdue ? (
                <LockCountdown lockDate={lockDate} />
              ) : isOpen && isOverdue ? (
                <span className="text-xs text-ps-amber">Locking soon...</span>
              ) : (
                <span className="text-xs text-ps-text-ter">
                  {isScored ? "Finalised" : isLocked ? "Predictions locked" : ""}
                </span>
              )}
            </div>

            {/* Progress chips: outcomes + tiebreaker scores. Hidden until the
                round has fixtures. Score chip is hidden in knockout rounds
                where no event carries an exact_score EPT. */}
            {w.eventCount > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ProgressChip
                  label="Outcomes"
                  done={w.userPredictionCount}
                  total={w.eventCount}
                />
                {w.scoreEligibleCount > 0 && (
                  <ProgressChip
                    label="Scores"
                    done={w.userScoreCount}
                    total={w.scoreEligibleCount}
                  />
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function ProgressChip({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const complete = done >= total;
  const started = done > 0;
  const tone = complete
    ? "border-ps-green/40 bg-ps-green-soft text-ps-green"
    : started
      ? "border-ps-amber/40 bg-ps-amber-soft text-ps-amber-deep"
      : "border-ps-border bg-ps-chip text-ps-text-ter";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <span className="uppercase tracking-wide opacity-80">{label}</span>
      <span className="font-mono">
        {done}/{total}
      </span>
    </span>
  );
}

function StatusChip({
  isOpen,
  isLocked,
  isScored,
}: {
  isOpen: boolean;
  isLocked: boolean;
  isScored: boolean;
}) {
  if (isScored) {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Finalised
      </span>
    );
  }
  if (isLocked) {
    return (
      <span className="rounded-full bg-ps-amber/15 px-2 py-0.5 text-xs font-semibold text-ps-amber">
        Locked
      </span>
    );
  }
  if (isOpen) {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Open
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
      Upcoming
    </span>
  );
}

function LockCountdown({ lockDate }: { lockDate: Date }) {
  const now = new Date();
  const diff = lockDate.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let label: string;
  if (days > 0) {
    label = `Locks in ${days}d ${hours}h`;
  } else if (hours > 0) {
    label = `Locks in ${hours}h ${minutes}m`;
  } else {
    label = `Locks in ${minutes}m`;
  }

  return <span className="text-xs text-ps-text-sec">{label}</span>;
}
