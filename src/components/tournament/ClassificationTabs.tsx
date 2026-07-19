"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useT, useLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { ProfileButton } from "@/app/wc/entrant/[userId]/ProfileButton";
import { CascadeCard } from "@/components/CascadeCard";

const RivalPredictionsTab = dynamic(
  () => import("@/components/wc/RivalPredictionsTab").then(mod => mod.RivalPredictionsTab),
  { loading: () => <div className="animate-pulse h-32 bg-ps-surface rounded-lg" /> }
);

const LEADERBOARD_KEYS = new Set(["overall", "format"]);

interface Classification {
  id: string;
  classification_key: string;
  name: string;
  classification_type: string;
  status: string;
}

interface AccuracyStat {
  correct: number;
  total: number;
  pct: number;
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
  accuracy?: {
    outcome: AccuracyStat | null;
    exact: AccuracyStat | null;
  };
}


interface GroupMemberData {
  user_id: string;
  display_name: string;
  points: number;
  predictions_made: number;
  predictions_total: number;
  is_self: boolean;
  status: string;
}

interface GroupInfo {
  id: string;
  name: string;
  groupNumber: number;
  targetSize?: number;
  members: GroupMemberData[];
}

interface MyGroupData {
  status: "draw_pending" | "drawn" | "draw_error" | "no_classification";
  drawAt?: string | null;
  error?: string;
  group?: {
    name: string;
    groupNumber: number;
    members: GroupMemberData[];
  } | null;
  allGroups?: GroupInfo[];
  myGroupId?: string | null;
  totalMembers?: number;
  archivedGroups?: GroupInfo[];
  eliminatedMembers?: EliminatedMember[];
}

interface EliminatedMember {
  user_id: string;
  display_name: string;
  points: number;
  is_self: boolean;
  source_group: string | null;
  status: string;
}

interface LeaderboardTag {
  tagName: string;
  tagCategory: string;
  status: string;
  stats: Record<string, unknown>;
  definition: {
    layer1: string;
    layer2: string;
    factCard: { fact: string; statTemplate: string; contextTemplate: string };
    visual: { borderColor: string; gold?: boolean; opacity?: number };
  };
}

export function ClassificationTabs({
  classifications,
  competitionId,
  currentUserId,
  inviteCode,
  kickoffIso,
  memberCount,
  maxEntrants,
  minEntrants,
  currentDisplayName,
  formatPhases,
}: {
  classifications: Classification[];
  competitionId: string;
  currentUserId: string;
  inviteCode?: string | null;
  kickoffIso?: string | null;
  memberCount?: number;
  maxEntrants?: number | null;
  minEntrants?: number | null;
  currentDisplayName?: string;
  formatPhases?: Array<{ id: string; phase_name: string; phase_order: number; status: string }>;
}) {
  const t = useT();
  const searchParams = useSearchParams();
  const RIVALS_TAB = "__rivals__";
  const initialRivalEventId = searchParams.get("eventId");
  const tabParam = searchParams.get("tab");

  const visibleClassifications = useMemo(
    () => classifications.filter((c) => c.status !== "draft" && LEADERBOARD_KEYS.has(c.classification_key)),
    [classifications],
  );
  const formatClassification = visibleClassifications.find(
    (c) => c.classification_key === "format"
  );
  const [activeId, setActiveId] = useState<string>(() => {
    if (tabParam === "rivals") return RIVALS_TAB;
    // Deep-link to a classification by key (e.g. ?tab=overall, ?tab=format)
    if (tabParam) {
      const match = visibleClassifications.find((c) => c.classification_key === tabParam);
      if (match) return match.id;
    }
    return formatClassification?.id ?? visibleClassifications[0]?.id ?? "";
  });
  // Phase selector for format classification historical views
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [phaseName, setPhaseName] = useState<string | null>(null);

  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>("");
  const [selfVisibility, setSelfVisibility] = useState<"public" | "private">("public");
  const [groupData, setGroupData] = useState<MyGroupData | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [tagsByUser, setTagsByUser] = useState<Map<string, LeaderboardTag>>(new Map());
  const [hasLiveEvents, setHasLiveEvents] = useState(false);
  const [groupHasLiveEvents, setGroupHasLiveEvents] = useState(false);
  const [groupFetchKey, setGroupFetchKey] = useState(0);
  const [liveMode, setLiveMode] = useState(true);
  const [liveEventsExist, setLiveEventsExist] = useState(false);
  const [liveMatches, setLiveMatches] = useState<Array<{
    id: string;
    event_name: string;
    home_score: number;
    away_score: number;
    status: string;
    start_time: string;
  }>>([]);
  const [livePredictionsByUser, setLivePredictionsByUser] = useState<Record<string, Array<{
    event_id: string;
    prediction_type: string;
    home_score?: number;
    away_score?: number;
    winner?: string;
  }>>>({});
  const [showPicks, setShowPicks] = useState(false);

  // Listen for scoring broadcasts to auto-refresh standings
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("scoring_events")
      .on("broadcast", { event: "scores_updated" }, (payload) => {
        const data = payload.payload as { competition_id?: string } | undefined;
        if (!data?.competition_id || data.competition_id === competitionId) {
          setFetchKey((k) => k + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [competitionId]);

  // Fetch reputation tags for leaderboard badges (feature-flagged)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEATURE_TAGS !== "true") return;
    let cancelled = false;

    fetch(`/api/tournament/competition-tags?competitionId=${competitionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, LeaderboardTag>();
        for (const t of data?.tags ?? []) {
          map.set(t.userId, t);
        }
        setTagsByUser(map);
      })
      .catch(() => {
        // Silently fail — tags are non-critical
      });

    return () => { cancelled = true; };
  }, [competitionId]);

  // Reset per-tab state when switching tabs
  useEffect(() => {
    setShowPicks(false);
    setLiveEventsExist(false);
    setSelectedPhaseId(null);
    setPhaseName(null);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    const standingsUrl = selectedPhaseId
      ? `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}&phaseId=${selectedPhaseId}`
      : `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}&provisional=true${liveMode ? "&live=true" : ""}`;
    fetch(standingsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStandings(data?.standings ?? []);
          setSelfVisibility(data?.selfVisibility === "private" ? "private" : "public");
          setHasLiveEvents(Boolean(data?.hasLiveEvents));
          if (data?.hasLiveEvents) setLiveEventsExist(true);
          setLiveMatches(data?.liveMatches ?? []);
          setLivePredictionsByUser(data?.livePredictionsByUser ?? {});
          setPhaseName(data?.phaseName ?? null);
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
  }, [activeId, competitionId, fetchKey, liveMode, selectedPhaseId]);

  // While matches are live, poll standings every 60s (paused when the tab is
  // hidden) so provisional points update without a manual refresh.
  useEffect(() => {
    if (!hasLiveEvents) return;
    const interval = setInterval(() => {
      if (!document.hidden) setFetchKey((k) => k + 1);
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) setFetchKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasLiveEvents]);

  // Fetch group data when format tab is active; re-fetch on groupFetchKey
  // changes (driven by the live-polling effect below).
  useEffect(() => {
    const active = visibleClassifications.find((c) => c.id === activeId);
    if (active?.classification_key !== "format") {
      setGroupData(null);
      setGroupHasLiveEvents(false);
      return;
    }

    let cancelled = false;

    fetch(
      `/api/tournament/my-group?classificationId=${activeId}&competitionId=${competitionId}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setGroupData(data);
          setGroupHasLiveEvents(Boolean(data?.hasLiveEvents));
          if (data?.hasLiveEvents) setLiveEventsExist(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupData(null);
          setGroupHasLiveEvents(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeId, competitionId, visibleClassifications, groupFetchKey]);

  // While group matches are live, poll group data every 60s (paused when
  // the tab is hidden) so provisional points update in the group view.
  useEffect(() => {
    if (!groupHasLiveEvents) return;
    const interval = setInterval(() => {
      if (!document.hidden) setGroupFetchKey((k) => k + 1);
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) setGroupFetchKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [groupHasLiveEvents]);

  const isLoading = loading || loadedId !== activeId;

  if (visibleClassifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        {t('classification.no_config')}
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
            className={`whitespace-nowrap rounded-md px-3 py-1.5 min-h-[44px] text-xs font-semibold transition-colors ${
              cls.id === activeId
                ? "bg-ps-surface text-ps-text shadow-sm"
                : "text-ps-text-sec hover:text-ps-text"
            }`}
          >
            {shortLabel(cls.classification_key, t)}
          </button>
        ))}
        {/* Rival Predictions tab — standalone, not tied to a classification */}
        <button
          key={RIVALS_TAB}
          onClick={() => { setActiveId(RIVALS_TAB); }}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 min-h-[44px] text-xs font-semibold transition-colors ${
            activeId === RIVALS_TAB
              ? "bg-ps-amber text-ps-text shadow-sm"
              : "text-ps-text-sec hover:text-ps-text"
          }`}
        >
          {t("rivals.tab_label")}
        </button>
      </div>

      {/* ── Rival Predictions tab content ── */}
      {activeId === RIVALS_TAB && (
        <div className="mt-4 flex flex-1 flex-col">
          <RivalPredictionsTab
            competitionId={competitionId}
            currentUserId={currentUserId}
            initialEventId={initialRivalEventId}
          />
        </div>
      )}

      {/* Entrant counter */}
      {activeId !== RIVALS_TAB && memberCount !== undefined && (
        <EntrantCounter
          count={memberCount}
          max={maxEntrants ?? null}
          min={minEntrants ?? null}
        />
      )}

      {/* Live / Confirmed toggle — visible when live events exist */}
      {activeId !== RIVALS_TAB && (hasLiveEvents || liveEventsExist) && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <LiveConfirmedToggle liveMode={liveMode} onToggle={() => { setLiveMode((m) => !m); setLoading(true); }} />
          {liveMode && hasLiveEvents && (
            <ShowPicksToggle showPicks={showPicks} onToggle={() => setShowPicks((s) => !s)} />
          )}
        </div>
      )}

      {/* Live match ticker — shows scores + minute when in live mode */}
      {activeId !== RIVALS_TAB && liveMode && liveMatches.length > 0 && (
        <LiveMatchTicker matches={liveMatches} />
      )}

      {/* ── Classification content (hidden when Rival Predictions tab is active) ── */}
      {activeId !== RIVALS_TAB && (
        <>
          {/* Format draw countdown — top */}
          {active?.classification_key === "format" &&
            groupData?.status === "draw_pending" &&
            groupData.drawAt && (
              <FormatDrawBanner
                drawAt={groupData.drawAt}
                label={t('classification.format_draw_in')}
              />
            )}

          {/* Rules preview — always show for format, pre-kickoff for others */}
          {active && (active.classification_key === "format" || (kickoffIso && new Date(kickoffIso).getTime() > Date.now())) && (
            <ClassificationRulesPreview classificationKey={active.classification_key} />
          )}

          {/* Format: Your Group card + All groups view, OR single-group preview */}
          {active?.classification_key === "format" && (
            groupData?.allGroups && groupData.allGroups.length > 0 ? (() => {
              // Knockout mode: single active group that isn't a group-stage group
              const isKnockout = groupData.allGroups.length === 1 &&
                !groupData.allGroups[0].name.startsWith("Group ");

              // Split archived groups into knockout stages and group-stage groups
              const knockoutArchived = (groupData.archivedGroups ?? []).filter(
                (g) => !g.name.startsWith("Group ")
              );
              const groupStageArchived = (groupData.archivedGroups ?? []).filter(
                (g) => g.name.startsWith("Group ")
              );

              return (
                <div className="mt-4">
                  {isKnockout ? (
                    <>
                      <KnockoutLeaderboard
                        group={groupData.allGroups[0]}
                        currentUserId={currentUserId}
                        isLive={groupHasLiveEvents}
                      />
                      {knockoutArchived.length > 0 && (
                        <KnockoutResultsSection groups={knockoutArchived} />
                      )}
                      {groupStageArchived.length > 0 && (
                        <HistoricalGroupsSection groups={groupStageArchived} />
                      )}
                    </>
                  ) : (
                    /* Group stage: existing layout */
                    <>
                      {groupData.myGroupId && (() => {
                        const myGroup = groupData.allGroups!.find((g) => g.id === groupData.myGroupId);
                        return myGroup ? <YourGroupCard group={myGroup} isLive={groupHasLiveEvents} /> : null;
                      })()}
                      <div className={groupData.myGroupId ? "mt-3" : ""}>
                        <AllGroupsView groups={groupData.allGroups} myGroupId={groupData.myGroupId ?? null} isLive={groupHasLiveEvents} />
                      </div>
                    </>
                  )}
                </div>
              );
            })() : (
              <FormatGroupCard
                groupData={groupData}
                displayName={currentDisplayName ?? "You"}
              />
            )
          )}

          {/* Standings (non-format tabs only, or format before groups load) */}
          {!(active?.classification_key === "format" && groupData?.allGroups && groupData.allGroups.length > 0) && (
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
              <>
              {/* Phase selector — browse historical format stages */}
              {formatPhases && formatPhases.length > 0 && active?.classification_type === "format_elimination" && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => { setSelectedPhaseId(null); setLoading(true); setFetchKey((k) => k + 1); }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      !selectedPhaseId
                        ? "bg-ps-amber text-white"
                        : "bg-ps-surface border border-ps-border text-ps-text-sec hover:border-ps-amber"
                    }`}
                  >
                    Current
                  </button>
                  {formatPhases.filter((p) => p.status === "finalised").map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPhaseId(p.id); setLoading(true); }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        selectedPhaseId === p.id
                          ? "bg-ps-amber text-white"
                          : "bg-ps-surface border border-ps-border text-ps-text-sec hover:border-ps-amber"
                      }`}
                    >
                      {p.phase_name}
                    </button>
                  ))}
                </div>
              )}
              {phaseName && selectedPhaseId && (
                <p className="text-xs text-ps-text-ter mb-2 font-mono uppercase tracking-wider">
                  {phaseName} — final standings
                </p>
              )}
              <StandingsTable
                standings={standings}
                currentUserId={currentUserId}
                classificationType={active?.classification_type ?? "leaderboard"}
                isLive={hasLiveEvents && liveMode}
                selfVisibility={selfVisibility}
                tagsByUser={tagsByUser}
                classificationKey={active?.classification_key}
                showPicks={showPicks}
                livePredictionsByUser={livePredictionsByUser}
                liveMatches={liveMatches}
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
                      `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}&provisional=true&live=true`,
                    ).then((r) => r.json());
                    setStandings(data?.standings ?? []);
                  } catch {
                    setSelfVisibility(prev);
                  }
                }}
              />
              </>
            )}
          </div>
          )}

          {/* Format draw countdown — bottom */}
          {active?.classification_key === "format" &&
            groupData?.status === "draw_pending" &&
            groupData.drawAt && (
              <FormatDrawBanner
                drawAt={groupData.drawAt}
                label={t('classification.know_group_in')}
              />
            )}
        </>
      )}
    </div>
  );
}

function LiveConfirmedToggle({
  liveMode,
  onToggle,
}: {
  liveMode: boolean;
  onToggle: () => void;
}) {
  const t = useT();

  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex rounded-lg bg-ps-bg p-1">
        <button
          type="button"
          onClick={() => { if (!liveMode) onToggle(); }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            liveMode
              ? "bg-ps-surface text-ps-text shadow-sm"
              : "text-ps-text-sec hover:text-ps-text"
          }`}
        >
          <span className="inline-flex h-2 w-2 items-center justify-center">
            <span className={`h-1.5 w-1.5 rounded-full ${liveMode ? "animate-pulse bg-ps-red" : "bg-ps-text-ter/40"}`} />
          </span>
          {t('leaderboard.as_it_stands')}
        </button>
        <button
          type="button"
          onClick={() => { if (liveMode) onToggle(); }}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            !liveMode
              ? "bg-ps-surface text-ps-text shadow-sm"
              : "text-ps-text-sec hover:text-ps-text"
          }`}
        >
          {t('leaderboard.confirmed')}
        </button>
      </div>
    </div>
  );
}

function ShowPicksToggle({
  showPicks,
  onToggle,
}: {
  showPicks: boolean;
  onToggle: () => void;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        showPicks
          ? "bg-ps-surface text-ps-text shadow-sm border border-ps-border"
          : "border border-ps-border/50 text-ps-text-ter hover:text-ps-text hover:border-ps-border"
      }`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {showPicks ? (
          <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5ZM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M2 2l12 12M6.5 6.5a2.1 2.1 0 0 0 3 3M4 4.5C2.8 5.7 2 8 2 8s2.5 5 6 5c1.2 0 2.3-.4 3.2-1M14 8s-.7-1.5-2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {t('leaderboard.show_picks')}
    </button>
  );
}

function LiveMatchTicker({
  matches,
}: {
  matches: Array<{
    event_name: string;
    home_score: number;
    away_score: number;
    status: string;
    start_time: string;
  }>;
}) {
  return (
    <div className="mt-2 space-y-1.5">
      {matches.map((m, i) => {
        const parts = m.event_name.split(" vs ");
        const home = parts[0]?.trim() ?? m.event_name;
        const away = parts[1]?.trim() ?? "";
        // Format status: if it's a bare number, show as minute with apostrophe
        const statusLabel = /^\d+$/.test(m.status) ? `${m.status}'` : m.status;

        return (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-ps-red/20 bg-ps-red/5 px-3 py-2"
          >
            <span className="flex-1 truncate text-right text-xs font-semibold text-ps-text">
              {home}
            </span>
            <div className="mx-2 flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold text-ps-text">
                {m.home_score}
              </span>
              <span className="text-xs text-ps-text-ter">-</span>
              <span className="font-mono text-sm font-bold text-ps-text">
                {m.away_score}
              </span>
            </div>
            <span className="flex-1 truncate text-xs font-semibold text-ps-text">
              {away}
            </span>
            <span className="ml-2 shrink-0 rounded-full bg-ps-red/15 px-1.5 py-0.5 text-micro font-bold text-ps-red">
              {statusLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FormatDrawBanner({
  drawAt,
  label,
}: {
  drawAt: string;
  label: string;
}) {
  const t = useT();
  const [countdown, setCountdown] = useState(() => formatCountdown(drawAt, t));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(drawAt, t));
    }, 60_000);
    return () => clearInterval(interval);
  }, [drawAt, t]);

  return (
    <div className="mt-3 rounded-xl border border-ps-amber/20 bg-ps-amber/5 px-4 py-3 text-center">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-amber-deep">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-bold text-ps-text">
        {countdown}
      </p>
    </div>
  );
}

function FlipRow({
  row,
  isMe,
  isEliminated,
  isFormat,
  isBracket,
  selfVisibility,
  onToggleVisibility,
  tag,
  classificationKey,
  showPicks = false,
  livePredictions,
  liveMatches,
}: {
  row: StandingRow;
  isMe: boolean;
  isEliminated: boolean;
  isFormat: boolean;
  isBracket: boolean;
  selfVisibility: "public" | "private";
  onToggleVisibility: (next: "public" | "private") => void;
  tag?: LeaderboardTag;
  classificationKey?: string;
  showPicks?: boolean;
  livePredictions?: Array<{ event_id: string; prediction_type: string; home_score?: number; away_score?: number; winner?: string }>;
  liveMatches?: Array<{ id: string; event_name: string; home_score: number; away_score: number; status: string; start_time: string }>;
}) {
  const t = useT();
  const [flipped, setFlipped] = useState(false);
  const hasAccuracy = row.accuracy?.outcome != null || row.accuracy?.exact != null;
  const hasPredictions = livePredictions && livePredictions.length > 0;
  const canFlip = (!showPicks && hasPredictions) || (hasAccuracy && !isBracket);

  // Opaque backgrounds needed for backface-visibility to work.
  // Semi-transparent amber bleeds through, so pre-compute the opaque equivalent.
  const faceBg = isMe ? "bg-ps-amber-soft" : "bg-ps-surface";

  return (
    <div
      className={`${isEliminated ? "opacity-50" : ""}`}
      onClick={canFlip ? () => setFlipped((f) => !f) : undefined}
      style={canFlip ? { cursor: "pointer", WebkitTapHighlightColor: "transparent" } : undefined}
    >
      <div className="relative" style={{ perspective: "600px" }}>
        <div
          className="transition-transform duration-300"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateX(180deg)" : "rotateX(0deg)",
          }}
        >
          {/* ── Front face ── */}
          <div
            className={`flex items-center px-3 py-2.5 ${faceBg} transition-opacity duration-300 ${flipped ? "opacity-0" : "opacity-100"}`}
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-ps-text-ter">
              {row.rank}
            </span>
            <div className="flex flex-1 items-center gap-2 pl-2 min-w-0">
              <span
                className={`truncate text-sm ${isMe ? "font-bold text-ps-text" : "text-ps-text"}`}
              >
                {row.display_name}
              </span>
              {tag && (
                <LeaderboardTagBadge tag={tag} displayName={row.display_name} />
              )}
              {isMe && (
                <span className="shrink-0 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                  {t('classification.you_label')}
                </span>
              )}
              {isMe && !isFormat && process.env.NEXT_PUBLIC_PRODUCT_MODE !== "world_cup_2026_archive" && (
                <span onClick={(e) => e.stopPropagation()}>
                  <VisibilityToggle
                    visibility={selfVisibility}
                    onToggle={onToggleVisibility}
                  />
                </span>
              )}
              {isEliminated && (
                <span className="shrink-0 rounded bg-ps-red/15 px-1 py-0.5 text-micro font-bold text-ps-red">
                  {row.status === "dead" ? t('classification.dead') : t('classification.out')}
                </span>
              )}
              {row.movement !== undefined && row.movement !== 0 && !isEliminated && (
                <span
                  className={`shrink-0 text-micro font-bold ${
                    row.movement > 0 ? "text-ps-green" : "text-ps-red"
                  }`}
                >
                  {row.movement > 0 ? `+${row.movement}` : row.movement}
                </span>
              )}
            </div>
            {/* Inline prediction chips (visible when showPicks toggle is on) */}
            {showPicks && hasPredictions && (
              <span className="mx-1.5 shrink-0 font-mono text-xs font-semibold text-ps-text-sec">
                {livePredictions!.map((p, i) => (
                  <span key={p.event_id}>
                    {i > 0 && <span className="text-ps-text-ter"> · </span>}
                    {p.prediction_type === "exact_score" && p.home_score != null && p.away_score != null
                      ? `${p.home_score}–${p.away_score}`
                      : p.winner ?? "?"}
                  </span>
                ))}
              </span>
            )}
            {/* Profile icon — always show for other users (anonymised names still link to profiles) */}
            {!isMe && (
              <ProfileButton userId={row.user_id} displayName={row.display_name} from={classificationKey} />
            )}
            <span className={`w-16 shrink-0 text-right font-mono text-sm font-bold ${isMe ? "text-ps-amber" : "text-ps-text"}`}>
              {row.points}
            </span>
            {canFlip && isMe && (
              <svg
                className="ml-1 h-3.5 w-3.5 shrink-0 text-ps-text-ter"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 6.5h8M4 9.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {/* ── Back face ── */}
          <div
            className={`absolute inset-0 flex items-center px-3 py-2.5 ${faceBg}`}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateX(180deg)",
            }}
          >
            {/* Show predictions on back when toggle is off but predictions exist */}
            {!showPicks && hasPredictions ? (
              <div className="flex flex-1 items-center min-w-0">
                <span className={`truncate text-sm ${isMe ? "font-bold text-ps-text" : "text-ps-text"}`}>
                  {row.display_name}
                </span>
                <span className="ml-auto shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text-sec">
                  {livePredictions!.map((p, i) => {
                    const match = liveMatches?.find((m) => m.id === p.event_id);
                    const trigrams = match?.event_name?.split(" vs ") ?? [];
                    if (p.prediction_type === "exact_score" && p.home_score != null && p.away_score != null) {
                      return (
                        <span key={p.event_id} className="inline-flex items-center">
                          {i > 0 && <span className="mx-1.5 text-ps-text-ter">·</span>}
                          {trigrams[0] && <span className="text-micro font-semibold text-ps-text-ter">{trigrams[0].slice(0, 3).toUpperCase()}</span>}
                          <span className={`mx-1 ${isMe ? "text-ps-amber" : "text-ps-text"}`}>{p.home_score}–{p.away_score}</span>
                          {trigrams[1] && <span className="text-micro font-semibold text-ps-text-ter">{trigrams[1].slice(0, 3).toUpperCase()}</span>}
                        </span>
                      );
                    }
                    return (
                      <span key={p.event_id} className="inline-flex items-center">
                        {i > 0 && <span className="mx-1.5 text-ps-text-ter">·</span>}
                        <span className={`${isMe ? "text-ps-amber" : "text-ps-text"}`}>{p.winner ?? "?"}</span>
                      </span>
                    );
                  })}
                </span>
              </div>
            ) : (
              <div className="flex flex-1 items-center">
                {/* Outcome */}
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-xl font-extrabold tabular-nums leading-none tracking-tight text-ps-green">
                    {row.accuracy?.outcome ? `${row.accuracy.outcome.pct}%` : "\u2014"}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-caption font-semibold text-ps-text-sec leading-tight">
                      {t('stats.outcome')}
                    </span>
                    <span className="font-mono text-caption text-ps-text-ter leading-tight">
                      {row.accuracy?.outcome
                        ? `${row.accuracy.outcome.correct}/${row.accuracy.outcome.total}`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-2.5 h-6 w-px shrink-0 bg-ps-border-strong" />

                {/* Exact Score */}
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-xl font-extrabold tabular-nums leading-none tracking-tight text-ps-amber">
                    {row.accuracy?.exact ? `${row.accuracy.exact.pct}%` : "\u2014"}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-caption font-semibold text-ps-text-sec leading-tight">
                      {t('stats.exact_score')}
                    </span>
                    <span className="font-mono text-caption text-ps-text-ter leading-tight">
                      {row.accuracy?.exact
                        ? `${row.accuracy.exact.correct}/${row.accuracy.exact.total}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Flip-back icon */}
            <svg
              className="ml-2 h-3.5 w-3.5 shrink-0 rotate-180 text-ps-text-ter"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="M4 6.5h8M4 9.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTagBadge({ tag, displayName }: { tag: LeaderboardTag; displayName: string }) {
  const [expanded, setExpanded] = useState(false);
  const isGhost = tag.tagName === "Ghost";
  const isGold = tag.definition.visual.gold;

  const interpolate = (tpl: string) =>
    tpl.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === "name") return displayName;
      const val = tag.stats[key];
      return val != null ? String(val) : `{${key}}`;
    });

  return (
    <span className="shrink-0 relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center rounded-full px-1.5 py-0.5 transition-opacity hover:opacity-80"
        style={{
          backgroundColor: isGold ? "#f59e0b" : tag.definition.visual.borderColor,
          opacity: isGhost ? 0.6 : 1,
        }}
        aria-expanded={expanded}
      >
        <span
          className="font-display text-[10px] font-extrabold uppercase leading-none text-white"
          style={{ letterSpacing: "0.05em" }}
        >
          {tag.definition.layer1}
        </span>
      </button>

      {expanded && (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-ps-border bg-ps-surface shadow-lg"
          style={{ borderLeft: `3px solid ${tag.definition.visual.borderColor}` }}
        >
          <div className="px-3 py-2.5">
            <p
              className="font-display text-xs font-extrabold uppercase text-ps-text"
              style={{ letterSpacing: "0.06em" }}
            >
              {tag.definition.layer1}
            </p>
            <p className="mt-0.5 font-serif text-xs italic text-ps-text">
              {interpolate(tag.definition.layer2)}
            </p>
            <p className="mt-1 font-mono text-xs text-ps-amber">
              {interpolate(tag.definition.factCard.statTemplate)}
            </p>
            <p className="mt-0.5 text-[11px] text-ps-text-ter">
              {interpolate(tag.definition.factCard.contextTemplate)}
            </p>
            <div className="mt-1.5 border-t border-ps-border/40 pt-1.5">
              <p className="text-[11px] leading-relaxed text-ps-text-sec">
                {tag.definition.factCard.fact}
              </p>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

function StandingsTable({
  standings,
  currentUserId,
  classificationType,
  isLive = false,
  selfVisibility,
  tagsByUser,
  onToggleVisibility,
  classificationKey,
  showPicks = false,
  livePredictionsByUser = {},
  liveMatches = [],
}: {
  standings: StandingRow[];
  currentUserId: string;
  classificationType: string;
  isLive?: boolean;
  selfVisibility: "public" | "private";
  tagsByUser: Map<string, LeaderboardTag>;
  onToggleVisibility: (next: "public" | "private") => void;
  classificationKey?: string;
  showPicks?: boolean;
  livePredictionsByUser?: Record<string, Array<{ event_id: string; prediction_type: string; home_score?: number; away_score?: number; winner?: string }>>;
  liveMatches?: Array<{ id: string; event_name: string; home_score: number; away_score: number; status: string; start_time: string }>;
}) {
  const t = useT();
  const isBracket = classificationType === "bracket_survivor";
  const isFormat = classificationType === "format_elimination";

  return (
    <div className="divide-y divide-ps-border overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex items-center px-3 py-2 text-xs font-semibold text-ps-text-ter">
        <span className="w-8 text-center">#</span>
        <span className="flex-1 pl-2">
          {t('leaderboard.player')}
          {isLive && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 align-middle text-micro font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t('picks.live')}
            </span>
          )}
        </span>
        <span className="w-16 text-right">
          {isBracket ? t('classification.correct') : t('common.pts')}
        </span>
      </div>

      {standings.map((row, i) => {
        const isMe = row.user_id === currentUserId;
        const isEliminated = row.eliminated || row.status === "eliminated" || row.status === "dead";

        return (
          <CascadeCard key={row.user_id} index={i} speed="rise">
            <FlipRow
              row={row}
              isMe={isMe}
              isEliminated={isEliminated}
              isFormat={isFormat}
              isBracket={isBracket}
              selfVisibility={selfVisibility}
              onToggleVisibility={onToggleVisibility}
              tag={tagsByUser.get(row.user_id)}
              classificationKey={classificationKey}
              showPicks={showPicks}
              livePredictions={livePredictionsByUser[row.user_id]}
              liveMatches={liveMatches}
            />
          </CascadeCard>
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
  const t = useT();
  const isPrivate = visibility === "private";
  const [confirmPending, setConfirmPending] = useState<"public" | "private" | null>(null);

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setConfirmPending(isPrivate ? "public" : "private")}
        aria-label={
          isPrivate
            ? t('classification.anon_desc')
            : t('classification.public_desc')
        }
        className={`rounded px-1.5 py-0.5 text-micro font-semibold transition-colors ${
          isPrivate
            ? "bg-ps-text-ter/15 text-ps-text-ter hover:bg-ps-text-ter/25"
            : "bg-ps-amber/10 text-ps-amber hover:bg-ps-amber/20"
        }`}
      >
        {isPrivate ? t('classification.anon') : t('classification.hide_me')}
      </button>

      {confirmPending && (
        <>
          {/* Backdrop to dismiss on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmPending(null);
            }}
          />
          {/* Confirmation popover */}
          <div
            className="absolute right-0 top-full mt-1 w-56 bg-ps-surface border border-ps-border rounded-lg shadow-lg p-3 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-ps-text-sec mb-2">
              {confirmPending === "private"
                ? t('classification.confirm_hide')
                : t('classification.confirm_show')}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onToggle(confirmPending);
                  setConfirmPending(null);
                }}
                className="bg-ps-amber text-white rounded px-3 py-1.5 text-xs font-semibold min-h-[44px]"
              >
                {confirmPending === "private"
                  ? t('classification.confirm_hide_yes')
                  : t('classification.confirm_show_yes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmPending(null)}
                className="text-ps-text-sec text-xs font-semibold min-h-[44px] px-3 py-1.5"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

function shortLabel(key: string, t: (k: string) => string): string {
  const labels: Record<string, string> = {
    overall: t('classification.overall_label'),
    format: t('classification.format_label'),
    full_bracket: t('classification.bracket_label'),
    knockout_bracket: t('classification.ko_bracket_label'),
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
  const t = useT();
  const daysUntil = kickoffIso ? daysFromNow(kickoffIso) : null;

  const headline = isDraft
    ? t('standings.not_opened')
    : daysUntil && daysUntil > 0
      ? t('standings.kickoff_in', {
          days: daysUntil,
          dayLabel: daysUntil === 1 ? t('standings.day_singular') : t('standings.day_plural'),
        })
      : t('standings.will_appear');

  return (
    <div className="w-full rounded-xl border border-ps-border bg-ps-surface px-4 py-6">
      <p className="text-center text-sm text-ps-text-sec">{headline}</p>
      {inviteCode && (
        <div className="mt-5 border-t border-ps-border pt-5">
          <p className="text-center text-xs text-ps-text-ter">
            {t('standings.bring_rival')}
          </p>
          <InviteCodeBlock code={inviteCode} />
        </div>
      )}
    </div>
  );
}

function InviteCodeBlock({ code }: { code: string }) {
  const t = useT();
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
          {copied ? t('create.copied') : t('create.copy')}
        </span>
      </button>
      {error && (
        <p className="text-xs text-ps-red">
          {t('create.copy_error')}
        </p>
      )}
    </div>
  );
}

function EntrantCounter({
  count,
  max,
  min,
}: {
  count: number;
  max: number | null;
  min: number | null;
}) {
  const t = useT();
  const belowMin = min !== null && count < min;

  return (
    <div className="mt-3">
      {belowMin ? (
        <p className="text-center text-xs font-medium text-ps-amber">
          {t('classification.entrants_min', { count, min: min! })}
        </p>
      ) : max ? (
        <p className="text-center font-mono text-xs text-ps-text-ter">
          {t('classification.entrants_max', { count, max })}
        </p>
      ) : (
        <p className="text-center font-mono text-xs text-ps-text-ter">
          {t('classification.entrants_count', { count })}
        </p>
      )}
    </div>
  );
}

function FlagToggle() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const nextLocale: Locale = locale === "es" ? "en" : "es";
  const targetFlag = locale === "es" ? "ca" : "mx";
  const toggleLabel =
    locale === "es" ? t("common.switch_to_en") : t("common.switch_to_es");

  const w = 28;
  const h = Math.round((w * 3) / 4);
  const r = Math.round(w * 0.35);
  const clip = `path('M 0 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} Z')`;

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      aria-label={toggleLabel}
      title={toggleLabel}
      className="flex shrink-0 items-center justify-center rounded-full p-2 transition-opacity hover:opacity-80 active:scale-95"
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <span
        className="relative inline-block shrink-0 bg-ps-surface"
        style={{
          width: w,
          height: h,
          clipPath: clip,
          WebkitClipPath: clip,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
        }}
      >
        <img
          src={`https://flagcdn.com/${targetFlag}.svg`}
          alt=""
          width={w}
          height={h}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "saturate(0.88) brightness(0.96)" }}
        />
      </span>
    </button>
  );
}

function ClassificationRulesPreview({
  classificationKey,
}: {
  classificationKey: string;
}) {
  const t = useT();
  const storageKey = `rules-dismissed-${classificationKey}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  const heading =
    classificationKey === "format" ? t('rules_preview.format_heading')
    : classificationKey === "overall" ? t('rules_preview.overall_heading')
    : classificationKey === "full_bracket" ? t('rules_preview.bracket_heading')
    : classificationKey === "knockout_bracket" ? t('rules_preview.ko_bracket_heading')
    : null;

  if (!heading) return null;

  function toggleDismissed() {
    setDismissed((prev) => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // Collapsed: just show the heading with a tap-to-expand chevron
  if (dismissed) {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface px-4 py-3">
        <button
          type="button"
          onClick={toggleDismissed}
          className="flex w-full items-center justify-between"
        >
          <h3 className="text-sm font-bold text-ps-text">{heading}</h3>
          <svg className="h-4 w-4 text-ps-text-ter" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded: full card with collapse chevron
  if (classificationKey === "format") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ps-text">{heading}</h3>
          <div className="flex items-center gap-2">
            <FlagToggle />
            <button type="button" onClick={toggleDismissed} className="flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded text-ps-text-ter hover:text-ps-text" aria-label="Collapse">
              <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <ScoringRow label={t('rules_preview.format_scoring_winner')} points={t('rules_preview.format_scoring_winner_pts')} />
          <ScoringRow label={t('rules_preview.format_scoring_score')} points={t('rules_preview.format_scoring_score_pts')} />
          <ScoringRow label={t('rules_preview.format_scoring_advance')} points={t('rules_preview.format_scoring_advance_pts')} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.format_p1')}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.format_p2')}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.format_p3')}
        </p>
      </div>
    );
  }

  if (classificationKey === "overall") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ps-text">{heading}</h3>
          <div className="flex items-center gap-2">
            <FlagToggle />
            <button type="button" onClick={toggleDismissed} className="flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded text-ps-text-ter hover:text-ps-text" aria-label="Collapse">
              <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-1 font-serif text-xs italic text-ps-text-sec">
          {t('rules_preview.overall_tagline')}
        </p>
        <div className="mt-3 space-y-2">
          <ScoringRow label={t('rules_preview.format_scoring_winner')} points={t('rules_preview.format_scoring_winner_pts')} />
          <ScoringRow label={t('rules_preview.format_scoring_score')} points={t('rules_preview.format_scoring_score_pts')} />
          <ScoringRow label={t('rules_preview.format_scoring_advance')} points={t('rules_preview.format_scoring_advance_pts')} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.overall_p1')}
        </p>
      </div>
    );
  }

  if (classificationKey === "full_bracket") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ps-text">{heading}</h3>
          <button type="button" onClick={toggleDismissed} className="flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded text-ps-text-ter hover:text-ps-text" aria-label="Collapse">
            <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.bracket_p1')}
        </p>
      </div>
    );
  }

  if (classificationKey === "knockout_bracket") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ps-text">{heading}</h3>
          <button type="button" onClick={toggleDismissed} className="flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded text-ps-text-ter hover:text-ps-text" aria-label="Collapse">
            <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          {t('rules_preview.ko_bracket_p1')}
        </p>
      </div>
    );
  }

  return null;
}

function ScoringRow({ label, points }: { label: string; points: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ps-text-sec">{label}</span>
      <span className="font-mono text-xs font-bold text-ps-text">{points}</span>
    </div>
  );
}

// ============================================================
// Preview cards
// ============================================================

const BLURRED_NAMES = [
  "████████████",
  "██████████",
  "████████████████",
  "██████████████",
  "████████████",
  "██████████████████",
  "████████████",
  "██████████",
  "████████████████",
  "██████████████",
  "████████████",
];

function FormatGroupCard({
  groupData,
  displayName,
}: {
  groupData: MyGroupData | null;
  displayName: string;
}) {
  const t = useT();
  if (!groupData) return null;

  if (groupData.status === "draw_error") {
    return (
      <div className="mt-4 rounded-xl border border-ps-red/40 bg-ps-red/5 p-4">
        <h3 className="text-sm font-bold text-ps-red">{t('group.draw_failed')}</h3>
        <p className="mt-1 text-xs text-ps-text-sec">
          {groupData.error || t('group.draw_error_fallback')}
        </p>
      </div>
    );
  }

  if (groupData.status === "draw_pending") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ps-text">{t('dash.your_group')}</h3>
          {groupData.drawAt && <DrawCountdown drawAt={groupData.drawAt} />}
        </div>
        <div className="mt-3 divide-y divide-ps-border rounded-lg border border-ps-border">
          {/* User's row */}
          <div className="flex items-center px-3 py-2.5 bg-ps-amber/5">
            <span className="flex-1 text-sm font-semibold text-ps-text">{displayName}</span>
            <span className="w-12 text-center font-mono text-xs text-ps-text-ter">&mdash;</span>
            <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">0 {t('common.pts')}</span>
          </div>
          {/* Blurred placeholders */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center px-3 py-2.5">
              <span className="flex-1 text-sm text-ps-text-ter select-none blur-[5px]">
                {BLURRED_NAMES[i]}
              </span>
              <span className="w-12 text-center font-mono text-xs text-ps-text-ter">&mdash;</span>
              <span className="w-14 text-right font-mono text-xs text-ps-text-ter">0 {t('common.pts')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groupData.status === "drawn" && groupData.group) {
    const { group } = groupData;
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-sm font-bold text-ps-text">{group.name}</h3>
        <div className="mt-3 divide-y divide-ps-border overflow-hidden rounded-lg border border-ps-border">
          {group.members.map((m, i) => (
            <CascadeCard key={m.user_id} index={i} speed="rise">
              <div
                className={`flex items-center px-3 py-2.5 ${m.is_self ? "bg-ps-amber/5" : ""}`}
              >
                <span className={`flex-1 text-sm ${m.is_self ? "font-semibold text-ps-text" : "text-ps-text"}`}>
                  {m.display_name}
                  {m.is_self && (
                    <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                      {t('classification.you_label')}
                    </span>
                  )}
                </span>
                <span className="w-12 text-center font-mono text-xs text-ps-text-ter">
                  {m.predictions_made}/{m.predictions_total}
                </span>
                <span className="w-14 text-right font-mono text-xs font-bold text-ps-text">
                  {m.points} {t('common.pts')}
                </span>
              </div>
            </CascadeCard>
          ))}
        </div>
      </div>
    );
  }

  return null;
}


function DrawCountdown({ drawAt }: { drawAt: string }) {
  const t = useT();
  const [label, setLabel] = useState(() => formatCountdown(drawAt, t));

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(formatCountdown(drawAt, t));
    }, 60_000);
    return () => clearInterval(interval);
  }, [drawAt, t]);

  return (
    <span className="text-caption font-medium text-ps-amber">{label}</span>
  );
}

function formatCountdown(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return t('group.drawing');
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return t('group.drawn_in_dh', { days, hours });
  if (hours > 0) return t('group.drawn_in_hm', { hours, minutes });
  return t('group.drawn_in_m', { minutes });
}

function daysFromNow(iso: string): number {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ============================================================
// Your Group — qualification card with colour-coded zones
// ============================================================

function getQualificationZone(
  rank: number,
  groupSize: number,
): "qualify" | "best-third" | "eliminated" {
  // Top 2 always qualify
  if (rank <= 2) return "qualify";

  if (groupSize === 5 && rank === 3) return "qualify";
  if (groupSize === 4 && rank === 3) return "best-third";

  return "eliminated";
}

function QualificationRuleSummary({ groupSize }: { groupSize: number }) {
  const t = useT();

  if (groupSize === 3) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5 text-micro font-semibold">
        <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-ps-green">
          {t('group.top2_qualify')}
        </span>
        <span className="rounded-full bg-ps-red/15 px-2 py-0.5 text-ps-red">
          {t('group.third_out')}
        </span>
      </div>
    );
  }

  if (groupSize === 4) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5 text-micro font-semibold">
        <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-ps-green">
          {t('group.top2_qualify')}
        </span>
        <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-orange-400">
          {t('group.third_best_pool')}
        </span>
        <span className="rounded-full bg-ps-red/15 px-2 py-0.5 text-ps-red">
          {t('group.fourth_out')}
        </span>
      </div>
    );
  }

  if (groupSize >= 5) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5 text-micro font-semibold">
        <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-ps-green">
          {t('group.top3_qualify')}
        </span>
        <span className="rounded-full bg-ps-red/15 px-2 py-0.5 text-ps-red">
          {groupSize === 5 ? t('group.nth_out', { last: '5' }) : t('group.nth_out', { last: String(groupSize) })}
        </span>
      </div>
    );
  }

  return null;
}

function YourGroupCard({
  group,
  isLive = false,
}: {
  group: GroupInfo;
  isLive?: boolean;
}) {
  const t = useT();
  const groupSize = group.members.length;

  const zoneStyles = {
    qualify: "border-l-ps-green bg-ps-green/[0.06]",
    "best-third": "border-l-orange-400 bg-orange-400/[0.06]",
    eliminated: "border-l-ps-red bg-ps-red/[0.06]",
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-ps-amber/40 bg-ps-surface ring-1 ring-ps-amber/20">
      {/* Header */}
      <div className="flex items-center justify-between bg-ps-amber/5 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ps-text">{group.name}</h3>
            <span className="rounded bg-ps-amber/20 px-1.5 py-0.5 text-micro font-bold text-ps-amber">
              {t('classification.you_label')}
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {t('picks.live')}
              </span>
            )}
          </div>
          <QualificationRuleSummary groupSize={groupSize} />
        </div>
        <span className="text-micro font-medium text-ps-text-ter">
          {t('group.players_count', { count: groupSize })}
        </span>
      </div>

      {/* Consolidation / remainder notices */}
      {(group.targetSize ?? 4) > 4 && (
        <p className="border-b border-ps-border bg-ps-chip px-4 py-2 text-xs text-ps-text-sec">
          {t('group.consolidated')}
        </p>
      )}
      {groupSize < 3 && (
        <p className="border-b border-ps-border bg-ps-amber/10 px-4 py-2 text-xs text-ps-amber">
          {t('group.remainder_hint')}
        </p>
      )}

      {/* Members with zone indicators */}
      <div className="divide-y divide-ps-border overflow-hidden">
        {group.members.map((m, i) => {
          const rank = i + 1;
          const zone = getQualificationZone(rank, groupSize);

          return (
            <CascadeCard key={m.user_id} index={i} speed="rise">
              <div
                className={`flex items-center border-l-[3px] px-3 py-2 ${zoneStyles[zone]} ${
                  m.is_self ? "!bg-ps-amber/10" : ""
                }`}
              >
                <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                  {rank}
                </span>
                <span
                  className={`flex-1 truncate pl-2 text-sm ${
                    m.is_self ? "font-semibold text-ps-text" : "text-ps-text"
                  }`}
                >
                  {m.display_name}
                  {m.is_self && (
                    <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                      {t('classification.you_label')}
                    </span>
                  )}
                </span>
                <span className="w-14 text-right font-mono text-sm font-bold text-ps-text">
                  {m.points}
                </span>
              </div>
            </CascadeCard>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Knockout Leaderboard — active group with gold cutoff line
// ============================================================

function KnockoutLeaderboard({
  group,
  currentUserId,
  isLive = false,
}: {
  group: GroupInfo;
  currentUserId: string;
  isLive?: boolean;
}) {
  const t = useT();
  const cutoffPosition = Math.floor(group.members.length / 2);

  return (
    <div className="overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex items-center justify-between bg-ps-amber/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ps-text">{group.name}</h3>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t('picks.live')}
            </span>
          )}
        </div>
        <span className="text-micro font-medium text-ps-text-ter">
          {group.members.length} {t('leaderboard.player').toLowerCase()}s
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-3 py-1.5 text-micro font-semibold text-ps-text-ter border-b border-ps-border">
        <span className="w-6 text-center">#</span>
        <span className="flex-1 pl-2">{t('leaderboard.player')}</span>
        <span className="w-14 text-right">{t('common.pts')}</span>
      </div>

      {/* Members with cutoff line */}
      <div className="divide-y divide-ps-border overflow-hidden">
        {group.members.map((m, i) => {
          const rank = i + 1;
          const isSelf = m.user_id === currentUserId;
          const belowCut = rank > cutoffPosition;

          return (
            <CascadeCard key={m.user_id} index={i} speed="rise">
              <div>
                {/* Gold cutoff line after top half */}
                {rank === cutoffPosition + 1 && (
                  <div className="relative flex items-center px-3 py-1">
                    <div className="flex-1 border-t border-dashed border-ps-amber/40" />
                    <span className="mx-2 whitespace-nowrap text-micro font-semibold text-ps-amber/60">
                      {t('format_knockout_advance', { count: cutoffPosition })}
                    </span>
                    <div className="flex-1 border-t border-dashed border-ps-amber/40" />
                  </div>
                )}
                <div
                  className={`flex items-center px-3 py-2 ${
                    isSelf ? "bg-ps-amber/10" : belowCut ? "bg-ps-red/[0.03]" : ""
                  }`}
                >
                  <span className={`w-6 text-center font-mono text-xs font-bold ${
                    belowCut ? "text-ps-red/60" : "text-ps-text-ter"
                  }`}>
                    {rank}
                  </span>
                  <span
                    className={`flex-1 truncate pl-2 text-sm ${
                      isSelf ? "font-semibold text-ps-text" : belowCut ? "text-ps-text-sec" : "text-ps-text"
                    }`}
                  >
                    {m.display_name}
                    {isSelf && (
                      <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                        {t('classification.you_label')}
                      </span>
                    )}
                  </span>
                  <span className={`w-14 text-right font-mono text-sm font-bold ${
                    isSelf ? "text-ps-amber" : belowCut ? "text-ps-text-sec" : "text-ps-text"
                  }`}>
                    {m.points}
                  </span>
                </div>
              </div>
            </CascadeCard>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Eliminated Section — collapsed list of eliminated members
// ============================================================

function EliminatedSection({
  members,
  stageName,
}: {
  members: EliminatedMember[];
  stageName: string;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-ps-red/20 bg-ps-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 text-ps-red/60 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-sm font-semibold text-ps-text-sec">
            {t('format_eliminated_after', { stage: stageName })}
          </span>
        </div>
        <span className="rounded-full bg-ps-red/10 px-2 py-0.5 text-micro font-bold text-ps-red">
          {members.length}
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-ps-border overflow-hidden border-t border-ps-border">
          {members.map((m, i) => (
            <CascadeCard key={m.user_id} index={i} speed="rise">
              <div
                className={`flex items-center px-3 py-2 opacity-50 ${m.is_self ? "!opacity-100 bg-ps-amber/10" : ""}`}
              >
                <span className="w-6 text-center text-micro text-ps-text-ter">-</span>
                <span className={`flex-1 truncate pl-2 text-sm ${m.is_self ? "font-semibold text-ps-text" : "text-ps-text-sec"}`}>
                  {m.display_name}
                  {m.source_group && (
                    <span className="ml-1.5 text-micro text-ps-text-ter">({m.source_group})</span>
                  )}
                  {m.is_self && (
                    <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                      {t('classification.you_label')}
                    </span>
                  )}
                </span>
                <span className="w-14 text-right font-mono text-sm text-ps-text-ter">
                  {m.points}
                </span>
              </div>
            </CascadeCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Knockout Results Section — collapsed accordion for each archived knockout group
// ============================================================

function KnockoutResultsSection({
  groups,
}: {
  groups: GroupInfo[];
}) {
  const t = useT();

  return (
    <>
      {[...groups].sort((a, b) => b.groupNumber - a.groupNumber).map((group) => (
        <KnockoutResultAccordion key={group.id} group={group} />
      ))}
    </>
  );
}

function KnockoutResultAccordion({ group }: { group: GroupInfo }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const cutoff = Math.floor(group.members.length / 2);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 text-ps-text-ter transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-sm font-semibold text-ps-text-sec">
            {group.name} {t('format_results_suffix')}
          </span>
        </div>
        <span className="rounded-full bg-ps-chip px-2 py-0.5 text-micro font-bold text-ps-text-ter">
          {group.members.length} {t('leaderboard.player').toLowerCase()}s
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-ps-border overflow-hidden border-t border-ps-border">
          {group.members.map((m, i) => {
            const rank = i + 1;
            const eliminated = m.status === "eliminated";
            return (
              <CascadeCard key={m.user_id} index={i} speed="rise">
                <div
                  className={`flex items-center px-3 py-2 ${
                    eliminated ? "opacity-50" : ""
                  } ${m.is_self ? "!opacity-100 bg-ps-amber/5" : ""}`}
                >
                  <span className={`w-6 text-center font-mono text-xs font-bold ${
                    rank > cutoff ? "text-ps-red/60" : "text-ps-text-ter"
                  }`}>
                    {rank}
                  </span>
                  <span className={`flex-1 truncate pl-2 text-sm ${
                    m.is_self ? "font-semibold text-ps-text" : "text-ps-text"
                  }`}>
                    {m.display_name}
                    {m.is_self && (
                      <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                        {t('classification.you_label')}
                      </span>
                    )}
                  </span>
                  <span className="w-14 text-right font-mono text-sm text-ps-text-ter">
                    {m.points}
                  </span>
                  {eliminated && (
                    <span className="ml-1.5 rounded bg-ps-red/15 px-1 py-0.5 text-micro font-bold text-ps-red">
                      OUT
                    </span>
                  )}
                </div>
              </CascadeCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Historical Groups Section — collapsed accordion of group stage results
// ============================================================

function HistoricalGroupsSection({
  groups,
}: {
  groups: GroupInfo[];
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 text-ps-text-ter transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-sm font-semibold text-ps-text-sec">
            {t('format_group_stage_results')}
          </span>
        </div>
        <span className="rounded-full bg-ps-chip px-2 py-0.5 text-micro font-bold text-ps-text-ter">
          {t('format_n_groups', { count: groups.length })}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-ps-border">
          <div className="space-y-2 p-3">
            {[...groups].sort((a, b) => a.groupNumber - b.groupNumber).map((group) => (
              <HistoricalGroupCard key={group.id} group={group} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalGroupCard({ group }: { group: GroupInfo }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const statusIcon = (status: string) => {
    if (status === "qualified_top") return "text-ps-green";
    if (status === "qualified_third") return "text-orange-400";
    return "text-ps-red";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-ps-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-bold text-ps-text">{group.name}</span>
        <svg
          className={`h-3 w-3 text-ps-text-ter transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="divide-y divide-ps-border overflow-hidden border-t border-ps-border">
          {group.members.map((m, i) => {
            const isEliminated = m.status === "eliminated";
            return (
              <CascadeCard key={m.user_id} index={i} speed="rise">
                <div
                  className={`flex items-center px-3 py-1.5 ${isEliminated ? "opacity-50" : ""} ${m.is_self ? "!opacity-100 bg-ps-amber/5" : ""}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-2 ${statusIcon(m.status)}`} style={{ backgroundColor: "currentColor" }} />
                  <span className={`flex-1 truncate text-xs ${m.is_self ? "font-semibold text-ps-text" : "text-ps-text"}`}>
                    {m.display_name}
                    {m.is_self && (
                      <span className="ml-1 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                        {t('classification.you_label')}
                      </span>
                    )}
                  </span>
                  <span className="w-12 text-right font-mono text-xs text-ps-text-ter">{m.points}</span>
                  {isEliminated && (
                    <span className="ml-1.5 rounded bg-ps-red/15 px-1 py-0.5 text-micro font-bold text-ps-red">OUT</span>
                  )}
                </div>
              </CascadeCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// All Groups View — user's group first, rest alphabetical
// ============================================================

function AllGroupsView({
  groups,
  myGroupId,
  isLive = false,
}: {
  groups: GroupInfo[];
  myGroupId: string | null;
  isLive?: boolean;
}) {
  const t = useT();

  // When myGroupId is set, YourGroupCard renders it separately above — skip here
  const ordered = groups
    .filter((g) => g.id !== myGroupId)
    .sort((a, b) => a.groupNumber - b.groupNumber);

  return (
    <div className="space-y-3">
      {ordered.map((group) => (
          <div
            key={group.id}
            className="rounded-xl border border-ps-border bg-ps-surface"
          >
            {/* Group header */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ps-text">{group.name}</h3>
                {isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {t('picks.live')}
                  </span>
                )}
              </div>
              <span className="text-micro font-medium text-ps-text-ter">
                {t('group.players_count', { count: group.members.length })}
              </span>
            </div>

            {/* Members */}
            <div className="divide-y divide-ps-border overflow-hidden">
              {group.members.map((m, i) => {
                const rank = i + 1;
                return (
                  <CascadeCard key={m.user_id} index={i} speed="rise">
                    <div
                      className={`flex items-center px-3 py-2 ${
                        m.is_self ? "bg-ps-amber/5" : ""
                      }`}
                    >
                      <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                        {rank}
                      </span>
                      <span
                        className={`flex-1 truncate pl-2 text-sm ${
                          m.is_self ? "font-semibold text-ps-text" : "text-ps-text"
                        }`}
                      >
                        {m.display_name}
                        {m.is_self && (
                          <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber">
                            {t('classification.you_label')}
                          </span>
                        )}
                      </span>
                      <span className="w-14 text-right font-mono text-sm font-bold text-ps-text">
                        {m.points}
                      </span>
                    </div>
                  </CascadeCard>
                );
              })}
            </div>
          </div>
      ))}
    </div>
  );
}
