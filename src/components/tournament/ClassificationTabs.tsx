"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n";

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

interface AllGroupsData {
  status: "drawn" | "no_groups";
  myGroupId: string | null;
  groups: Array<{
    id: string;
    name: string;
    groupNumber: number;
    members: Array<{
      user_id: string;
      display_name: string;
      points: number;
      is_self: boolean;
      status: string;
    }>;
  }>;
}

interface MyGroupData {
  status: "draw_pending" | "drawn" | "no_classification";
  drawAt?: string | null;
  group?: {
    name: string;
    groupNumber: number;
    members: Array<{
      user_id: string;
      display_name: string;
      points: number;
      predictions_made: number;
      predictions_total: number;
      is_self: boolean;
      status: string;
    }>;
  } | null;
  totalMembers?: number;
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
}) {
  const t = useT();
  const visibleClassifications = classifications.filter((c) => c.status !== "draft");
  const formatClassification = visibleClassifications.find(
    (c) => c.classification_key === "format"
  );
  const [activeId, setActiveId] = useState<string>(
    formatClassification?.id ?? visibleClassifications[0]?.id ?? ""
  );
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>("");
  const [selfVisibility, setSelfVisibility] = useState<"public" | "private">("public");
  const [groupData, setGroupData] = useState<MyGroupData | null>(null);
  const [allGroups, setAllGroups] = useState<AllGroupsData | null>(null);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    fetch(
      `/api/tournament/standings?classificationId=${activeId}&competitionId=${competitionId}&provisional=true`
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

  // Fetch group data when format tab is active
  useEffect(() => {
    const active = visibleClassifications.find((c) => c.id === activeId);
    if (active?.classification_key !== "format") {
      setGroupData(null);
      setAllGroups(null);
      return;
    }

    let cancelled = false;

    // Fetch user's own group (triggers lazy draw)
    fetch(
      `/api/tournament/my-group?classificationId=${activeId}&competitionId=${competitionId}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setGroupData(data);
          // Once drawn, fetch all groups
          if (data?.status === "drawn") {
            fetch(
              `/api/tournament/all-groups?classificationId=${activeId}&competitionId=${competitionId}`
            )
              .then((res) => res.json())
              .then((allData) => {
                if (!cancelled) setAllGroups(allData);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setGroupData(null);
      });

    return () => { cancelled = true; };
  }, [activeId, competitionId, visibleClassifications]);

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
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              cls.id === activeId
                ? "bg-ps-surface text-ps-text shadow-sm"
                : "text-ps-text-sec hover:text-ps-text"
            }`}
          >
            {shortLabel(cls.classification_key, t)}
          </button>
        ))}
      </div>

      {/* Entrant counter */}
      {memberCount !== undefined && (
        <EntrantCounter
          count={memberCount}
          max={maxEntrants ?? null}
          min={minEntrants ?? null}
        />
      )}

      {/* Format draw countdown — top */}
      {active?.classification_key === "format" &&
        groupData?.status === "draw_pending" &&
        groupData.drawAt && (
          <FormatDrawBanner
            drawAt={groupData.drawAt}
            label={t('classification.format_draw_in')}
          />
        )}

      {/* Pre-kickoff rules */}
      {kickoffIso && new Date(kickoffIso).getTime() > Date.now() && active && (
        <ClassificationRulesPreview classificationKey={active.classification_key} />
      )}

      {/* Preview cards (pre-kickoff) */}
      {kickoffIso && new Date(kickoffIso).getTime() > Date.now() && active && (
        <>
          {active.classification_key === "format" && (
            <FormatGroupCard
              groupData={groupData}
              displayName={currentDisplayName ?? "You"}
            />
          )}
        </>
      )}

      {/* Standings / All Groups */}
      <div className="mt-4 flex flex-1 flex-col">
        {active?.classification_key === "format" && allGroups?.status === "drawn" && allGroups.groups.length > 0 ? (
          <AllGroupsView groups={allGroups.groups} myGroupId={allGroups.myGroupId} />
        ) : isLoading ? (
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

      {/* Format draw countdown — bottom */}
      {active?.classification_key === "format" &&
        groupData?.status === "draw_pending" &&
        groupData.drawAt && (
          <FormatDrawBanner
            drawAt={groupData.drawAt}
            label={t('classification.know_group_in')}
          />
        )}
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
  const [countdown, setCountdown] = useState(() => formatCountdown(drawAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(drawAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [drawAt]);

  return (
    <div className="mt-3 rounded-xl border border-ps-amber/20 bg-ps-amber/5 px-4 py-3 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-amber-deep">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-bold text-ps-text">
        {countdown}
      </p>
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
  const t = useT();
  const isBracket = classificationType === "bracket_survivor";
  const isFormat = classificationType === "format_elimination";

  return (
    <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex items-center px-3 py-2 text-xs font-semibold text-ps-text-ter">
        <span className="w-8 text-center">#</span>
        <span className="flex-1 pl-2">{t('leaderboard.player')}</span>
        <span className="w-16 text-right">
          {isBracket ? t('classification.correct') : t('common.pts')}
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
                  {t('classification.you_label')}
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
                  {row.status === "dead" ? t('classification.dead') : t('classification.out')}
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
  const t = useT();
  const isPrivate = visibility === "private";
  return (
    <button
      type="button"
      onClick={() => onToggle(isPrivate ? "public" : "private")}
      aria-label={
        isPrivate
          ? t('classification.anon_desc')
          : t('classification.public_desc')
      }
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
        isPrivate
          ? "bg-ps-text-ter/15 text-ps-text-ter hover:bg-ps-text-ter/25"
          : "bg-ps-amber/10 text-ps-amber hover:bg-ps-amber/20"
      }`}
    >
      {isPrivate ? t('classification.anon') : t('classification.hide_me')}
    </button>
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

function ClassificationRulesPreview({
  classificationKey,
}: {
  classificationKey: string;
}) {
  if (classificationKey === "format") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-sm font-bold text-ps-text">How Format works</h3>
        <div className="mt-3 space-y-2">
          <ScoringRow label="Correct match outcome" points="2 pts" />
          <ScoringRow label="Exact score bonus" points="+3 pts" />
          <ScoringRow label="Correct advancing team (knockout)" points="1 pt" />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ps-text-sec">
          Players are drawn into groups of four. After each prediction window,
          the bottom player in each group is eliminated. New groups are drawn
          from the survivors. Last player standing wins.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          Points reset each window. Only your performance in the current round
          matters for survival.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          Groups are drawn 24 hours before the first match of each stage.
        </p>
      </div>
    );
  }

  if (classificationKey === "overall") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-sm font-bold text-ps-text">How Overall works</h3>
        <p className="mt-1 font-serif text-xs italic text-ps-text-sec">
          Even if you're out, you're in.
        </p>
        <div className="mt-3 space-y-2">
          <ScoringRow label="Correct match outcome" points="2 pts" />
          <ScoringRow label="Exact score bonus" points="+3 pts" />
          <ScoringRow label="Correct advancing team (knockout)" points="1 pt" />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ps-text-sec">
          Every point counts across the whole tournament. No elimination, no
          resets. Eliminated from the Format? Your Overall score keeps ticking.
          Consistency wins.
        </p>
      </div>
    );
  }

  if (classificationKey === "full_bracket") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-sm font-bold text-ps-text">How the Bracket works</h3>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          Predict the outcome of every group and every knockout tie before the
          tournament starts. As results come in, incorrect predictions are
          knocked out. Players with the most surviving picks lead the table.
        </p>
      </div>
    );
  }

  if (classificationKey === "knockout_bracket") {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-sm font-bold text-ps-text">How the KO Bracket works</h3>
        <p className="mt-2 text-xs leading-relaxed text-ps-text-sec">
          Once the group stage is finalised, predict every knockout tie from the
          Round of 32 to the Final. Same rules as the Full Bracket, but with
          the advantage of knowing who actually qualified.
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
        <div className="mt-3 divide-y divide-ps-border rounded-lg border border-ps-border">
          {group.members.map((m) => (
            <div
              key={m.user_id}
              className={`flex items-center px-3 py-2.5 ${m.is_self ? "bg-ps-amber/5" : ""}`}
            >
              <span className={`flex-1 text-sm ${m.is_self ? "font-semibold text-ps-text" : "text-ps-text"}`}>
                {m.display_name}
                {m.is_self && (
                  <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-[10px] font-bold text-ps-amber">
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
          ))}
        </div>
      </div>
    );
  }

  return null;
}


function DrawCountdown({ drawAt }: { drawAt: string }) {
  const [label, setLabel] = useState(() => formatCountdown(drawAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(formatCountdown(drawAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [drawAt]);

  return (
    <span className="text-[11px] font-medium text-ps-amber">{label}</span>
  );
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Drawing groups...";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `Groups drawn in ${days}d ${hours}h`;
  if (hours > 0) return `Groups drawn in ${hours}h ${minutes}m`;
  return `Groups drawn in ${minutes}m`;
}

function daysFromNow(iso: string): number {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ============================================================
// All Groups View — user's group first, rest alphabetical
// ============================================================

function AllGroupsView({
  groups,
  myGroupId,
}: {
  groups: AllGroupsData["groups"];
  myGroupId: string | null;
}) {
  const t = useT();

  // User's group first, then rest by groupNumber
  const myGroup = myGroupId ? groups.find((g) => g.id === myGroupId) : null;
  const otherGroups = groups
    .filter((g) => g.id !== myGroupId)
    .sort((a, b) => a.groupNumber - b.groupNumber);

  const ordered = myGroup ? [myGroup, ...otherGroups] : otherGroups;

  return (
    <div className="space-y-3">
      {ordered.map((group) => {
        const isMyGroup = group.id === myGroupId;
        return (
          <div
            key={group.id}
            className={`rounded-xl border bg-ps-surface ${
              isMyGroup
                ? "border-ps-amber/40 ring-1 ring-ps-amber/20"
                : "border-ps-border"
            }`}
          >
            {/* Group header */}
            <div className={`flex items-center justify-between px-3 py-2 ${
              isMyGroup ? "bg-ps-amber/5" : ""
            }`}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ps-text">{group.name}</h3>
                {isMyGroup && (
                  <span className="rounded bg-ps-amber/20 px-1.5 py-0.5 text-[10px] font-bold text-ps-amber">
                    {t('classification.you_label')}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-ps-text-ter">
                {group.members.length} players
              </span>
            </div>

            {/* Members */}
            <div className="divide-y divide-ps-border">
              {group.members.map((m, i) => {
                const rank = i + 1;
                return (
                  <div
                    key={m.user_id}
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
                        <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-[10px] font-bold text-ps-amber">
                          {t('classification.you_label')}
                        </span>
                      )}
                    </span>
                    <span className="w-14 text-right font-mono text-sm font-bold text-ps-text">
                      {m.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
