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
  userPredictionCount: number;
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

            {/* Lock countdown or user progress */}
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

              {w.eventCount > 0 && (
                <span
                  className={`font-mono text-xs font-semibold ${
                    w.userPredictionCount >= w.eventCount
                      ? "text-ps-green"
                      : w.userPredictionCount > 0
                        ? "text-ps-amber"
                        : "text-ps-text-ter"
                  }`}
                >
                  {w.userPredictionCount}/{w.eventCount} picked
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
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
