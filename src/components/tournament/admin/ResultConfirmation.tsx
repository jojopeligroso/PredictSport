"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Event {
  id: string;
  event_name: string;
  start_time: string;
  status: string; // 'upcoming' | 'locked' | 'resulted'
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
  round_id: string | null;
  sport: string;
  external_event_id: string | null;
}

interface WindowData {
  id: string;
  name: string;
  status: string;
  events: Event[];
}

interface ResultConfirmationProps {
  windows: WindowData[];
}

type ConfirmingState = Record<string, boolean>;
type ErrorState = Record<string, string>;
type FetchingState = Record<string, boolean>;

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatResultData(data: Record<string, unknown> | null): string {
  if (!data) return "\u2014";
  const scoreObj = data.score as Record<string, unknown> | undefined;
  const home = data.home_score ?? scoreObj?.home_score;
  const away = data.away_score ?? scoreObj?.away_score;
  if (home !== undefined && away !== undefined) {
    const periods = (scoreObj?.periods ?? null) as Record<string, { home?: number; away?: number }> | null;
    const pen = periods?.penalties;
    const penSuffix = pen?.home !== undefined && pen?.away !== undefined
      ? ` (${pen.home}\u2013${pen.away} pens)`
      : "";
    return `${home} \u2013 ${away}${penSuffix}`;
  }
  const { winner } = data as Record<string, unknown>;
  if (winner !== undefined) {
    return String(winner);
  }
  return JSON.stringify(data);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "resulted") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Resulted
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="rounded-full bg-ps-amber/15 px-2 py-0.5 text-xs font-semibold text-ps-amber">
        Locked
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
        Upcoming
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-ps-red/15 px-2 py-0.5 text-xs font-semibold text-ps-red">
        Cancelled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
      {status}
    </span>
  );
}

export function ResultConfirmation({ windows }: ResultConfirmationProps) {
  const router = useRouter();

  // Default to first locked window, fall back to first window
  const defaultWindowId =
    windows.find((w) => w.status === "locked")?.id ?? windows[0]?.id ?? "";
  const [selectedWindowId, setSelectedWindowId] = useState(defaultWindowId);

  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const events = selectedWindow?.events ?? [];

  const [confirming, setConfirming] = useState<ConfirmingState>({});
  const [errors, setErrors] = useState<ErrorState>({});
  const [fetching, setFetching] = useState<FetchingState>({});
  const [localResultData, setLocalResultData] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => {
    const allConfirmed = windows.flatMap((w) =>
      w.events.filter((e) => e.result_confirmed).map((e) => e.id)
    );
    return new Set(allConfirmed);
  });

  // Manual entry state per event
  const [manualEntryOpen, setManualEntryOpen] = useState<Record<string, boolean>>(
    {}
  );
  const [manualHomeScore, setManualHomeScore] = useState<Record<string, string>>(
    {}
  );
  const [manualAwayScore, setManualAwayScore] = useState<Record<string, string>>(
    {}
  );
  const [manualWinner, setManualWinner] = useState<Record<string, string>>({});
  const [penaltiesOpen, setPenaltiesOpen] = useState<Record<string, boolean>>({});
  const [manualPenHome, setManualPenHome] = useState<Record<string, string>>({});
  const [manualPenAway, setManualPenAway] = useState<Record<string, string>>({});

  const confirmedCount = events.filter(
    (e) => confirmedIds.has(e.id) || e.result_confirmed
  ).length;
  const totalCount = events.length;
  const progressPct =
    totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

  function getEventResultData(event: Event): Record<string, unknown> | null {
    return localResultData[event.id] ?? event.result_data;
  }

  function getEventStatus(event: Event): string {
    return localStatuses[event.id] ?? event.status;
  }

  async function handleConfirm(event: Event) {
    const resultData = getEventResultData(event);
    if (!resultData) return;

    setConfirming((prev) => ({ ...prev, [event.id]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });

    try {
      const res = await fetch("/api/tournament/confirm-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, result_data: resultData }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      setConfirmedIds((prev) => new Set([...prev, event.id]));

      // Check if all events in this window are now confirmed
      const newConfirmedCount = events.filter(
        (e) => e.id === event.id || confirmedIds.has(e.id) || e.result_confirmed
      ).length;
      if (newConfirmedCount === totalCount) {
        // All confirmed — refresh the page so FinalisationPanel updates
        router.refresh();
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [event.id]: err instanceof Error ? err.message : "Something went wrong",
      }));
    } finally {
      setConfirming((prev) => ({ ...prev, [event.id]: false }));
    }
  }

  async function handleFetchResult(event: Event) {
    if (!event.external_event_id) return;

    setFetching((prev) => ({ ...prev, [event.id]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });

    try {
      const res = await fetch("/api/sports/fetch-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: event.sport,
          externalEventId: event.external_event_id,
          eventId: event.id,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as {
        result: Record<string, unknown> | null;
        manual: boolean;
      };

      if (data.manual || !data.result) {
        setErrors((prev) => ({
          ...prev,
          [event.id]: "No result from providers. Use manual entry.",
        }));
      } else {
        // Update local state with fetched result
        setLocalResultData((prev) => ({
          ...prev,
          [event.id]: data.result!,
        }));
        setLocalStatuses((prev) => ({
          ...prev,
          [event.id]: "resulted",
        }));
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [event.id]: err instanceof Error ? err.message : "Something went wrong",
      }));
    } finally {
      setFetching((prev) => ({ ...prev, [event.id]: false }));
    }
  }

  function handleManualSubmit(event: Event) {
    const home = manualHomeScore[event.id];
    const away = manualAwayScore[event.id];
    const win = manualWinner[event.id];

    if (home === undefined && away === undefined && !win) return;

    const homeNum = home !== undefined && home !== "" ? Number(home) : undefined;
    const awayNum = away !== undefined && away !== "" ? Number(away) : undefined;

    // Penalty data
    const hasPens = penaltiesOpen[event.id] ?? false;
    const penH = hasPens ? Number(manualPenHome[event.id] ?? "") : NaN;
    const penA = hasPens ? Number(manualPenAway[event.id] ?? "") : NaN;
    const validPens = hasPens && !isNaN(penH) && !isNaN(penA);

    // Build score object with periods if penalties exist
    const parts = event.event_name.split(/\s+(?:vs?\.?|v)\s+/i);
    const homeTeam = parts[0]?.trim() ?? "Home";
    const awayTeam = parts[1]?.trim() ?? "Away";

    const resultData: Record<string, unknown> = {};
    if (homeNum !== undefined) resultData.home_score = homeNum;
    if (awayNum !== undefined) resultData.away_score = awayNum;
    if (win) resultData.winner = win;

    // Build structured score object
    if (homeNum !== undefined && awayNum !== undefined) {
      const scoreObj: Record<string, unknown> = {
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: homeNum,
        away_score: awayNum,
        periods: validPens ? { penalties: { home: penH, away: penA } } : null,
      };
      resultData.score = scoreObj;
    }

    // Derive winner from scores if not explicitly set
    if (homeNum !== undefined && awayNum !== undefined && !resultData.winner) {
      if (homeNum > awayNum) resultData.winner = homeTeam;
      else if (awayNum > homeNum) resultData.winner = awayTeam;
      else if (validPens) {
        // Draw in regular time — winner from penalties
        resultData.winner = penH > penA ? homeTeam : awayTeam;
      } else {
        resultData.winner = "draw";
      }
    }

    setLocalResultData((prev) => ({
      ...prev,
      [event.id]: resultData,
    }));
    setLocalStatuses((prev) => ({
      ...prev,
      [event.id]: "resulted",
    }));
    setManualEntryOpen((prev) => ({
      ...prev,
      [event.id]: false,
    }));
  }

  return (
    <div className="w-full max-w-[480px]">
      {/* Window selector */}
      {windows.length > 1 && (
        <div className="mb-4">
          <label
            htmlFor="window-select"
            className="mb-1 block text-xs font-semibold text-ps-text-sec"
          >
            Select round
          </label>
          <select
            id="window-select"
            value={selectedWindowId}
            onChange={(e) => setSelectedWindowId(e.target.value)}
            className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
          >
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ps-text">
            {selectedWindow?.name ?? "No window selected"}
          </h2>
          <p className="mt-0.5 text-xs text-ps-text-sec">
            {confirmedCount}/{totalCount} results confirmed
          </p>
        </div>
        <span
          className={`font-mono text-sm font-bold ${
            confirmedCount === totalCount && totalCount > 0
              ? "text-ps-green"
              : "text-ps-amber"
          }`}
        >
          {progressPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
        <div
          className="h-full rounded-full bg-ps-green transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-ps-text-sec">
          No events in this round.
        </p>
      ) : (
        <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
          {events.map((event) => {
            const isConfirmed =
              confirmedIds.has(event.id) || event.result_confirmed;
            const isConfirming = confirming[event.id] ?? false;
            const isFetching = fetching[event.id] ?? false;
            const resultData = getEventResultData(event);
            const eventStatus = getEventStatus(event);
            const canConfirm =
              !isConfirmed &&
              resultData !== null &&
              (eventStatus === "resulted" || eventStatus === "locked");
            const canFetchResult =
              !isConfirmed &&
              resultData === null &&
              event.external_event_id !== null &&
              eventStatus !== "cancelled" &&
              eventStatus !== "upcoming";
            const isManualOpen = manualEntryOpen[event.id] ?? false;
            const errorMsg = errors[event.id];

            return (
              <div key={event.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ps-text">
                      {event.event_name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
                      {formatStartTime(event.start_time)}
                    </p>
                  </div>
                  <StatusBadge status={eventStatus} />
                </div>

                {/* Result row */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-sm text-ps-text-sec">
                    {resultData
                      ? formatResultData(resultData)
                      : eventStatus === "resulted" || isConfirmed
                        ? formatResultData(event.result_data)
                        : "Awaiting result"}
                  </span>

                  {isConfirmed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-ps-green">
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      Confirmed
                    </span>
                  ) : canConfirm ? (
                    <button
                      onClick={() => handleConfirm(event)}
                      disabled={isConfirming}
                      aria-label={`Confirm result for ${event.event_name}`}
                      className="flex items-center gap-1.5 rounded-lg bg-ps-green px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                    >
                      {isConfirming ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          />
                          Confirming...
                        </>
                      ) : (
                        "Confirm Result"
                      )}
                    </button>
                  ) : null}
                </div>

                {/* Action buttons for events without result data */}
                {!isConfirmed && !resultData && eventStatus !== "cancelled" && eventStatus !== "upcoming" && (
                  <div className="mt-2 flex items-center gap-2">
                    {canFetchResult && (
                      <button
                        onClick={() => handleFetchResult(event)}
                        disabled={isFetching}
                        className="flex items-center gap-1.5 rounded-lg border border-ps-border bg-ps-bg px-3 py-1.5 text-xs font-semibold text-ps-text transition-opacity hover:border-ps-amber disabled:opacity-50"
                      >
                        {isFetching ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="h-3 w-3 animate-spin rounded-full border-2 border-ps-amber/30 border-t-ps-amber"
                            />
                            Fetching...
                          </>
                        ) : (
                          "Fetch Result"
                        )}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setManualEntryOpen((prev) => ({
                          ...prev,
                          [event.id]: !prev[event.id],
                        }))
                      }
                      className="rounded-lg border border-ps-border bg-ps-bg px-3 py-1.5 text-xs font-semibold text-ps-text-sec transition-opacity hover:border-ps-amber hover:text-ps-text"
                    >
                      {isManualOpen ? "Cancel" : "Manual Entry"}
                    </button>
                  </div>
                )}

                {/* Manual entry form */}
                {isManualOpen && !isConfirmed && (
                  <div className="mt-3 space-y-2 rounded-lg border border-ps-border bg-ps-chip p-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-0.5 block text-xs text-ps-text-sec">
                          Home
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={manualHomeScore[event.id] ?? ""}
                          onChange={(e) =>
                            setManualHomeScore((prev) => ({
                              ...prev,
                              [event.id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-full rounded-lg border border-ps-border bg-ps-bg px-2 py-1.5 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-0.5 block text-xs text-ps-text-sec">
                          Away
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={manualAwayScore[event.id] ?? ""}
                          onChange={(e) =>
                            setManualAwayScore((prev) => ({
                              ...prev,
                              [event.id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-full rounded-lg border border-ps-border bg-ps-bg px-2 py-1.5 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                        />
                      </div>
                    </div>
                    {/* Penalties toggle + inputs */}
                    <div>
                      <label className="flex items-center gap-2 text-xs text-ps-text-sec cursor-pointer">
                        <input
                          type="checkbox"
                          checked={penaltiesOpen[event.id] ?? false}
                          onChange={(e) =>
                            setPenaltiesOpen((prev) => ({
                              ...prev,
                              [event.id]: e.target.checked,
                            }))
                          }
                          className="rounded border-ps-border accent-ps-amber"
                        />
                        Went to penalties
                      </label>
                      {(penaltiesOpen[event.id] ?? false) && (
                        <div className="mt-1.5 flex gap-2">
                          <div className="flex-1">
                            <label className="mb-0.5 block text-xs text-ps-text-sec">
                              Pen H
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={manualPenHome[event.id] ?? ""}
                              onChange={(e) =>
                                setManualPenHome((prev) => ({
                                  ...prev,
                                  [event.id]: e.target.value,
                                }))
                              }
                              placeholder="3"
                              className="w-full rounded-lg border border-ps-border bg-ps-bg px-2 py-1.5 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="mb-0.5 block text-xs text-ps-text-sec">
                              Pen A
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={manualPenAway[event.id] ?? ""}
                              onChange={(e) =>
                                setManualPenAway((prev) => ({
                                  ...prev,
                                  [event.id]: e.target.value,
                                }))
                              }
                              placeholder="4"
                              className="w-full rounded-lg border border-ps-border bg-ps-bg px-2 py-1.5 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-ps-text-sec">
                        Winner (optional if scores set)
                      </label>
                      <input
                        type="text"
                        value={manualWinner[event.id] ?? ""}
                        onChange={(e) =>
                          setManualWinner((prev) => ({
                            ...prev,
                            [event.id]: e.target.value,
                          }))
                        }
                        placeholder="Team name or draw"
                        className="w-full rounded-lg border border-ps-border bg-ps-bg px-2 py-1.5 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                      />
                    </div>
                    <button
                      onClick={() => handleManualSubmit(event)}
                      disabled={
                        !manualHomeScore[event.id] &&
                        !manualAwayScore[event.id] &&
                        !manualWinner[event.id]
                      }
                      className="w-full rounded-lg bg-ps-amber px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Set Result
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <p
                    role="alert"
                    className="mt-1.5 rounded-md bg-ps-red/10 px-2 py-1 text-xs text-ps-red"
                  >
                    {errorMsg}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
