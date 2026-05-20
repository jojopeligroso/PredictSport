"use client";

import { useState, useEffect } from "react";

interface Classification {
  id: string;
  classification_key: string;
  name: string;
  classification_type: string;
  status: string;
}

interface StandingRow {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  status: string;
  tie_break_values?: Record<string, number>;
  movement?: number;
  eliminated?: boolean;
}

export function ClassificationTabs({
  classifications,
  competitionId,
  currentUserId,
}: {
  classifications: Classification[];
  competitionId: string;
  currentUserId: string;
}) {
  const [activeId, setActiveId] = useState<string>(
    classifications[0]?.id ?? ""
  );
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>("");

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    fetch(
      `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStandings(data?.standings ?? []);
          setLoadedId(activeId);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStandings([]);
          setLoadedId(activeId);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeId, competitionId]);

  const isLoading = loading || loadedId !== activeId;

  if (classifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No classifications configured yet.
      </p>
    );
  }

  const active = classifications.find((c) => c.id === activeId);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-ps-bg p-1">
        {classifications.map((cls) => (
          <button
            key={cls.id}
            onClick={() => { setActiveId(cls.id); setLoading(true); }}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              cls.id === activeId
                ? "bg-ps-surface text-ps-text shadow-sm"
                : "text-ps-text-sec hover:text-ps-text"
            }`}
          >
            {shortLabel(cls.classification_key)}
          </button>
        ))}
      </div>

      {/* Standings */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ps-text-ter border-t-ps-text" />
          </div>
        ) : standings.length === 0 ? (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            {active?.status === "draft"
              ? "This classification hasn't started yet."
              : "No standings available yet."}
          </p>
        ) : (
          <StandingsTable
            standings={standings}
            currentUserId={currentUserId}
            classificationType={active?.classification_type ?? "leaderboard"}
          />
        )}
      </div>
    </div>
  );
}

function StandingsTable({
  standings,
  currentUserId,
  classificationType,
}: {
  standings: StandingRow[];
  currentUserId: string;
  classificationType: string;
}) {
  const isBracket = classificationType === "bracket_survivor";

  return (
    <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex items-center px-3 py-2 text-xs font-semibold text-ps-text-ter">
        <span className="w-8 text-center">#</span>
        <span className="flex-1 pl-2">Player</span>
        <span className="w-16 text-right">
          {isBracket ? "Correct" : "Pts"}
        </span>
      </div>

      {standings.map((row) => {
        const isMe = row.user_id === currentUserId;
        const isEliminated = row.eliminated || row.status === "eliminated" || row.status === "dead";

        return (
          <div
            key={row.user_id}
            className={`flex items-center px-3 py-2.5 ${
              isMe ? "bg-ps-amber/5" : ""
            } ${isEliminated ? "opacity-50" : ""}`}
          >
            <span className="w-8 text-center font-mono text-xs font-bold text-ps-text-ter">
              {row.rank}
            </span>
            <div className="flex flex-1 items-center gap-2 pl-2">
              <span
                className={`text-sm ${isMe ? "font-bold text-ps-text" : "text-ps-text"}`}
              >
                {row.display_name}
              </span>
              {isMe && (
                <span className="rounded bg-ps-amber/20 px-1 py-0.5 text-[10px] font-bold text-ps-amber">
                  YOU
                </span>
              )}
              {isEliminated && (
                <span className="rounded bg-ps-red/15 px-1 py-0.5 text-[10px] font-bold text-ps-red">
                  {row.status === "dead" ? "DEAD" : "OUT"}
                </span>
              )}
              {row.movement !== undefined && row.movement !== 0 && !isEliminated && (
                <span
                  className={`text-[10px] font-bold ${
                    row.movement > 0 ? "text-ps-green" : "text-ps-red"
                  }`}
                >
                  {row.movement > 0 ? `+${row.movement}` : row.movement}
                </span>
              )}
            </div>
            <span className="w-16 text-right font-mono text-sm font-bold text-ps-text">
              {row.points}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function shortLabel(key: string): string {
  const labels: Record<string, string> = {
    overall: "Overall",
    format: "Format",
    full_bracket: "Bracket",
    knockout_bracket: "KO Bracket",
  };
  return labels[key] ?? key;
}
