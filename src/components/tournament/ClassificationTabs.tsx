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
  inviteCode,
  kickoffIso,
}: {
  classifications: Classification[];
  competitionId: string;
  currentUserId: string;
  inviteCode?: string | null;
  kickoffIso?: string | null;
}) {
  const visibleClassifications = classifications.filter((c) => c.status !== "draft");
  const [activeId, setActiveId] = useState<string>(
    visibleClassifications[0]?.id ?? ""
  );
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>("");
  const [selfVisibility, setSelfVisibility] = useState<"public" | "private">("public");

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
          setSelfVisibility(data?.selfVisibility === "private" ? "private" : "public");
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

  if (visibleClassifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No classifications configured yet.
      </p>
    );
  }

  const active = visibleClassifications.find((c) => c.id === activeId);

  return (
    <div className="flex flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-ps-bg p-1">
        {visibleClassifications.map((cls) => (
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
      <div className="mt-4 flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ps-text-ter border-t-ps-text" />
          </div>
        ) : standings.length === 0 ? (
          <div className="flex flex-1 items-center justify-center pb-[10%]">
            <EmptyStandings
              isDraft={active?.status === "draft"}
              inviteCode={inviteCode ?? null}
              kickoffIso={kickoffIso ?? null}
            />
          </div>
        ) : (
          <StandingsTable
            standings={standings}
            currentUserId={currentUserId}
            classificationType={active?.classification_type ?? "leaderboard"}
            selfVisibility={selfVisibility}
            onToggleVisibility={async (next) => {
              const prev = selfVisibility;
              setSelfVisibility(next);
              try {
                const res = await fetch("/api/tournament/visibility", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ classificationId: activeId, visibility: next }),
                });
                if (!res.ok) throw new Error("toggle failed");
                const data = await fetch(
                  `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}`,
                ).then((r) => r.json());
                setStandings(data?.standings ?? []);
              } catch {
                setSelfVisibility(prev);
              }
            }}
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
  selfVisibility,
  onToggleVisibility,
}: {
  standings: StandingRow[];
  currentUserId: string;
  classificationType: string;
  selfVisibility: "public" | "private";
  onToggleVisibility: (next: "public" | "private") => void;
}) {
  const isBracket = classificationType === "bracket_survivor";
  const isFormat = classificationType === "format_elimination";

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
              {isMe && !isFormat && (
                <VisibilityToggle
                  visibility={selfVisibility}
                  onToggle={onToggleVisibility}
                />
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

function VisibilityToggle({
  visibility,
  onToggle,
}: {
  visibility: "public" | "private";
  onToggle: (next: "public" | "private") => void;
}) {
  const isPrivate = visibility === "private";
  return (
    <button
      type="button"
      onClick={() => onToggle(isPrivate ? "public" : "private")}
      aria-label={
        isPrivate
          ? "Currently anonymous. Tap to show your name on this leaderboard."
          : "Currently public. Tap to appear anonymously on this leaderboard."
      }
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
        isPrivate
          ? "bg-ps-text-ter/15 text-ps-text-ter hover:bg-ps-text-ter/25"
          : "bg-ps-amber/10 text-ps-amber hover:bg-ps-amber/20"
      }`}
    >
      {isPrivate ? "Anon" : "Hide me"}
    </button>
  );
}

function shortLabel(key: string): string {
  const labels: Record<string, string> = {
    overall: "Overall",
    format: "Format",
    full_bracket: "Bracket",
    knockout_bracket: "KO Bracket",
    r32_pick: "Last 32",
  };
  return labels[key] ?? key;
}

function EmptyStandings({
  isDraft,
  inviteCode,
  kickoffIso,
}: {
  isDraft: boolean;
  inviteCode: string | null;
  kickoffIso: string | null;
}) {
  const daysUntil = kickoffIso ? daysFromNow(kickoffIso) : null;

  const headline = isDraft
    ? "This classification hasn't opened yet."
    : daysUntil && daysUntil > 0
      ? `Standings open when results land. Kickoff in ${daysUntil} ${
          daysUntil === 1 ? "day" : "days"
        }.`
      : "Standings will appear here once results land.";

  return (
    <div className="w-full rounded-xl border border-ps-border bg-ps-surface px-4 py-6">
      <p className="text-center text-sm text-ps-text-sec">{headline}</p>
      {inviteCode && (
        <div className="mt-5 border-t border-ps-border pt-5">
          <p className="text-center text-xs text-ps-text-ter">
            Bring a rival before kickoff.
          </p>
          <InviteCodeBlock code={inviteCode} />
        </div>
      )}
    </div>
  );
}

function InviteCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    setError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers / non-secure contexts
        const el = document.createElement("textarea");
        el.value = code;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy competition code ${code}`}
        className="group flex items-center gap-2 rounded-lg border border-ps-border bg-ps-bg px-4 py-2 transition-colors hover:border-ps-amber/40"
      >
        <span className="font-mono text-base font-bold tracking-wider text-ps-text">
          {code}
        </span>
        <span
          aria-hidden="true"
          className="text-xs font-semibold text-ps-text-ter transition-colors group-hover:text-ps-amber-deep"
        >
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
      {error && (
        <p className="text-xs text-ps-red">
          Couldn&apos;t copy — long-press the code instead.
        </p>
      )}
    </div>
  );
}

function daysFromNow(iso: string): number {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
