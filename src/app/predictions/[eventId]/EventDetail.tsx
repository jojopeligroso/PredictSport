"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SectionHeader,
  PickButton,
  PersonaCallout,
  EmojiReactions,
  PickNote,
  SendToThread,
  Avatar,
  SPORT_CONFIG,
  type SportKey,
  toSportKey,
} from "@/components/ui";
import { PwaInstallGuide } from "@/components/PwaInstallGuide";
import { psDefaultPickCopy, psDefaultSheetCopy } from "@/lib/whatsapp";
import type {
  Event,
  EventPredictionType,
  Prediction,
  PredictionType,
  NoteVisibility,
} from "@/types/database";
import { parseWinnerOptions } from "@/lib/parse-options";
import { getPillLabel } from "@/lib/prediction-labels";

// ── Types ────────────────────────────────────────────────────────────────────

interface Member {
  user_id: string;
  display_name: string;
  callout_label: string | null;
}

interface CommunityPick {
  count: number;
  users: Array<{ user_id: string; display_name: string }>;
}

interface EventDetailProps {
  event: Event;
  competitionName: string;
  predictionTypes: EventPredictionType[];
  userPredictions: Prediction[];
  communityPredictions: Record<string, CommunityPick>;
  allPredictions: Array<{ id: string; user_id: string }>;
  members: Member[];
  reactions: Record<string, Record<string, number>>;
  isLocked: boolean;
  picksRevealed: boolean;
  currentUserId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(lockTime: string): string {
  const diff = new Date(lockTime).getTime() - Date.now();
  if (diff <= 0) return "LOCKED";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  return [d > 0 ? `${d}d` : "", `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function getPickOptions(
  ept: EventPredictionType,
  eventName?: string,
  sport?: string
): { id: string; label: string; sub?: string }[] | null {
  const cfg = ept.config ?? {};
  switch (ept.prediction_type) {
    case "winner": {
      const opts = cfg.options as string[] | undefined;
      if (opts && opts.length > 0) return opts.map((o) => ({ id: o, label: o }));
      // Fallback: derive from event name
      if (eventName) {
        const derived = parseWinnerOptions(eventName, sport);
        if (derived.length > 0) return derived.map((o) => ({ id: o, label: o }));
      }
      return null;
    }
    case "over_under": {
      const line = (cfg.line ?? cfg.threshold ?? "") as string | number;
      return [
        { id: "over", label: "Over", sub: String(line) },
        { id: "under", label: "Under", sub: String(line) },
      ];
    }
    case "head_to_head": {
      const opts = cfg.options as string[] | undefined;
      if (!opts || opts.length === 0) return null;
      return opts.map((o) => ({ id: o, label: o }));
    }
    case "yes_no": {
      const opts =
        (cfg.options as string[] | undefined) ?? ["Yes", "No"];
      return opts.map((o) => ({ id: o, label: o }));
    }
    case "top_n": {
      const opts = cfg.options as string[] | undefined;
      return opts?.map((o) => ({ id: o, label: o })) ?? null;
    }
    case "progression": {
      const stages = cfg.stages as string[] | undefined;
      return stages?.map((s) => ({ id: s, label: s })) ?? null;
    }
    case "handicap": {
      const opts = cfg.options as string[] | undefined;
      const line = cfg.line as number | undefined;
      const lineStr =
        line !== undefined ? (line > 0 ? `+${line}` : String(line)) : "";
      return opts?.map((o) => ({ id: o, label: o, sub: lineStr })) ?? null;
    }
    default:
      return null;
  }
}

function getPickValue(prediction: Prediction | undefined): string | null {
  if (!prediction) return null;
  const data = prediction.prediction_data ?? {};
  if (data.value !== undefined) return String(data.value);
  if (data.selection !== undefined) return String(data.selection);
  // margin: reconstruct compound key
  if (data.team !== undefined && data.range_low !== undefined) {
    return `${data.team}|${data.range_low}-${data.range_high}`;
  }
  // final_standings: reconstruct JSON rankings
  if (data.rankings !== undefined) {
    return JSON.stringify(data.rankings);
  }
  return null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Palette for community pick rows
const PICK_COLORS = [
  "#f59e0b",
  "#2563eb",
  "#dc2626",
  "#059669",
  "#7c3aed",
  "#ea580c",
];

// ── Component ────────────────────────────────────────────────────────────────

export function EventDetail({
  event,
  competitionName,
  predictionTypes,
  userPredictions,
  communityPredictions,
  allPredictions,
  members,
  reactions,
  isLocked,
  picksRevealed,
  currentUserId,
}: EventDetailProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState(
    userPredictions[0]?.note_text ?? ""
  );
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>(
    userPredictions[0]?.note_visibility ?? "public"
  );
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [activePicks, setActivePicks] = useState<Record<string, string>>(() => {
    const picks: Record<string, string> = {};
    for (const pred of userPredictions) {
      const val = getPickValue(pred);
      if (val) picks[pred.prediction_type] = val;
    }
    return picks;
  });

  const sportKey = toSportKey(event.sport);
  const sportCfg = SPORT_CONFIG[sportKey];

  // Total points available
  const totalPoints = predictionTypes.reduce((sum, ept) => sum + ept.points, 0);

  // Has the user made a pick for this page visit?
  const hasActivePick = Object.keys(activePicks).length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePick = useCallback(
    async (optionId: string, eptType: PredictionType) => {
      setActivePicks((prev) => ({ ...prev, [eptType]: optionId }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (submitting || !hasActivePick) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const ept of predictionTypes) {
        const pick = activePicks[ept.prediction_type];
        if (!pick) continue;

        // Build prediction_data based on type
        let predictionData: Record<string, unknown>;
        switch (ept.prediction_type) {
          case "winner":
            predictionData = { value: pick };
            break;
          case "top_n":
            predictionData = { value: pick, name: pick };
            break;
          case "progression":
            predictionData = { value: pick, stage: pick };
            break;
          case "handicap":
            predictionData = {
              selection: pick,
              line: (ept.config as Record<string, unknown>)?.line ?? 0,
            };
            break;
          case "margin": {
            const [team, range] = pick.split("|");
            const [low, high] = (range ?? "0-0").split("-").map(Number);
            predictionData = { team, range_low: low, range_high: high };
            break;
          }
          case "final_standings": {
            predictionData = { rankings: JSON.parse(pick) };
            break;
          }
          case "over_under":
            predictionData = {
              selection: pick,
              threshold: (ept.config as Record<string, unknown>)?.line ??
                (ept.config as Record<string, unknown>)?.threshold,
            };
            break;
          default:
            predictionData = { selection: pick };
        }

        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: event.id,
            competition_id: event.competition_id,
            prediction_type: ept.prediction_type,
            prediction_data: predictionData,
            note_text: noteText || undefined,
            note_visibility: noteVisibility,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { error?: string }).error ?? "Failed to submit prediction"
          );
        }
      }
      router.refresh();
      setShowPwaGuide(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    hasActivePick,
    predictionTypes,
    activePicks,
    event.id,
    event.competition_id,
    noteText,
    noteVisibility,
    router,
  ]);

  const handleReact = useCallback(
    async (predictionId: string, emoji: string) => {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_id: predictionId, emoji }),
      });
      router.refresh();
    },
    [router]
  );

  // ── Build community pick rows ────────────────────────────────────────────

  const allPickRows = (() => {
    if (!picksRevealed) return [];

    // Build a flat list of all picks with user info
    const rows: Array<{
      userId: string;
      displayName: string;
      initials: string;
      optionLabel: string;
      color: string;
      predictionId: string | null;
      note: { text: string; visibility: NoteVisibility } | null;
      reactions: Record<string, number>;
    }> = [];

    // Map user_id -> prediction_id from allPredictions
    const userPredMap = new Map<string, string>();
    for (const p of allPredictions) {
      userPredMap.set(p.user_id, p.id);
    }

    // Assign colors by option
    const optionColors = new Map<string, string>();
    let colorIdx = 0;

    for (const [optionLabel, group] of Object.entries(communityPredictions)) {
      if (!optionColors.has(optionLabel)) {
        optionColors.set(optionLabel, PICK_COLORS[colorIdx % PICK_COLORS.length]);
        colorIdx++;
      }
      const color = optionColors.get(optionLabel)!;

      for (const u of group.users) {
        const member = members.find((m) => m.user_id === u.user_id);
        const predId = userPredMap.get(u.user_id) ?? null;

        // Find note from userPredictions if this is the current user
        let note: { text: string; visibility: NoteVisibility } | null = null;
        if (u.user_id === currentUserId && userPredictions[0]?.note_text) {
          note = {
            text: userPredictions[0].note_text,
            visibility: userPredictions[0].note_visibility,
          };
        }

        rows.push({
          userId: u.user_id,
          displayName: member?.display_name ?? u.display_name,
          initials: getInitials(member?.display_name ?? u.display_name),
          optionLabel,
          color,
          predictionId: predId,
          note,
          reactions: predId ? (reactions[predId] ?? {}) : {},
        });
      }
    }

    return rows;
  })();

  const totalPicks = allPickRows.length;

  // Callout member
  const calloutMember = members.find((m) => m.callout_label);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ps-bg">
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--ps-text)",
          color: "var(--ps-bg)",
          padding: "16px 16px 22px",
        }}
      >
        {/* Back + sport label */}
        <div className="flex items-center justify-between">
          <Link
            href="/predictions"
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: "rgba(239,233,222,0.15)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {sportCfg.emoji} {sportCfg.name}
          </span>
          <div style={{ width: 32 }} />
        </div>

        {/* League subtitle */}
        <p
          className="mt-4"
          style={{
            fontSize: 11,
            opacity: 0.85,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {competitionName}
        </p>

        {/* Bebas title */}
        <h1
          className="mt-1.5 font-display"
          style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: 0.8 }}
        >
          {event.event_name}
        </h1>

        {/* Kickoff time */}
        <div
          className="mt-2 flex gap-3.5"
          style={{ fontSize: 11.5, opacity: 0.92, fontWeight: 500 }}
        >
          <span>
            {new Date(event.start_time).toLocaleDateString("en-IE", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Post-lock WhatsApp share */}
        {isLocked && picksRevealed && (
          <div className="mt-3.5">
            <SendToThread
              variant="block"
              defaultText={psDefaultSheetCopy(event.event_name)}
              label="Send to the WhatsApp group"
            />
          </div>
        )}
      </div>

      {/* ── 2. Lock indicator card ─────────────────────────────────────── */}
      <div
        className="mx-4 -mt-3.5 mb-0 flex items-center justify-between rounded-xl border border-ps-border bg-ps-surface p-2.5"
        style={{ boxShadow: "0 4px 14px rgba(40,30,20,0.06)" }}
      >
        <div>
          <p
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
            className="text-ps-text-sec"
          >
            {isLocked ? "Locked" : "Locks in"}
          </p>
          <p
            className="mt-0.5 font-display text-ps-amber-deep"
            style={{ fontSize: 18, letterSpacing: 0.6 }}
          >
            {isLocked ? "LOCKED" : formatCountdown(event.lock_time)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            style={{ fontSize: 10.5 }}
            className="font-semibold text-ps-text-sec"
          >
            worth
          </span>
          <span
            className="rounded-lg bg-ps-amber-soft px-2.5 py-1 font-display text-ps-amber-deep"
            style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}
          >
            +{totalPoints} PTS
          </span>
        </div>
      </div>

      {/* ── 3. Pick section ────────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        {predictionTypes.map((ept) => {
          const existingPred = userPredictions.find(
            (p) => p.prediction_type === ept.prediction_type
          );
          const currentPick =
            activePicks[ept.prediction_type] ?? getPickValue(existingPred);

          const typeLabel = getPillLabel(ept.prediction_type, ept.config);

          // ── Margin: two-step picker ──
          if (ept.prediction_type === "margin") {
            const cfg = ept.config ?? {};
            const teams = (cfg.options as string[] | undefined) ?? [];
            const ranges = (cfg.ranges as number[][] | undefined) ?? [
              [1, 2],
              [3, 4],
              [5, 99],
            ];
            // Parse current pick
            const [selectedTeam, selectedRange] = (currentPick ?? "").split("|");

            return (
              <div key={ept.id} className="mb-3">
                <SectionHeader label={`Your Pick \u00B7 ${typeLabel}`} />
                {/* Step 1: Team */}
                <div
                  className="grid gap-1.5 mt-2"
                  style={{
                    gridTemplateColumns:
                      teams.length <= 3
                        ? `repeat(${teams.length}, 1fr)`
                        : "1fr",
                  }}
                >
                  {teams.map((team) => (
                    <PickButton
                      key={team}
                      label={team}
                      selected={selectedTeam === team}
                      disabled={isLocked || submitting}
                      onClick={() => {
                        // If team changes, clear range
                        if (selectedTeam !== team) {
                          setActivePicks((prev) => ({
                            ...prev,
                            [ept.prediction_type]: `${team}|`,
                          }));
                        }
                      }}
                    />
                  ))}
                </div>
                {/* Step 2: Range (shown after team selected) */}
                {selectedTeam && (
                  <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: `repeat(${ranges.length}, 1fr)` }}>
                    {ranges.map((r) => {
                      const rangeLabel =
                        r[1] >= 99 ? `${r[0]}+` : `${r[0]}-${r[1]}`;
                      const rangeKey = `${r[0]}-${r[1]}`;
                      return (
                        <PickButton
                          key={rangeKey}
                          label={rangeLabel}
                          selected={selectedRange === rangeKey}
                          disabled={isLocked || submitting}
                          onClick={() => {
                            setActivePicks((prev) => ({
                              ...prev,
                              [ept.prediction_type]: `${selectedTeam}|${rangeKey}`,
                            }));
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── Final Standings: tap-to-rank ──
          if (ept.prediction_type === "final_standings") {
            const cfg = ept.config ?? {};
            const options = (cfg.options as string[] | undefined) ?? [];
            const positions = (cfg.positions as number | undefined) ?? options.length;

            // Parse current rankings from pick (JSON string)
            let rankings: Array<{ position: number; name: string }> = [];
            if (currentPick) {
              try {
                rankings = JSON.parse(currentPick);
              } catch {
                rankings = [];
              }
            }

            const nextPosition = rankings.length + 1;
            const isComplete = rankings.length >= positions;

            return (
              <div key={ept.id} className="mb-3">
                <SectionHeader label={`Your Pick \u00B7 ${typeLabel}`} />
                <p className="text-[11px] text-ps-text-ter mt-1 mb-2">
                  Tap in order: 1st, 2nd, 3rd...{" "}
                  {!isLocked && rankings.length > 0 && (
                    <button
                      className="text-ps-amber-deep font-semibold underline"
                      onClick={() =>
                        setActivePicks((prev) => ({
                          ...prev,
                          [ept.prediction_type]: "[]",
                        }))
                      }
                    >
                      Reset
                    </button>
                  )}
                </p>
                <div className="flex flex-col gap-1.5 mt-2">
                  {options.map((opt) => {
                    const assigned = rankings.find((r) => r.name === opt);
                    const isAssigned = !!assigned;
                    return (
                      <button
                        key={opt}
                        disabled={isLocked || submitting || (isComplete && !isAssigned)}
                        className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50"
                        style={{
                          borderColor: isAssigned
                            ? "var(--ps-amber)"
                            : "var(--ps-border)",
                          background: isAssigned
                            ? "var(--ps-amber-soft)"
                            : "var(--ps-surface)",
                        }}
                        onClick={() => {
                          if (isLocked || submitting) return;
                          let newRankings: Array<{ position: number; name: string }>;
                          if (isAssigned) {
                            // Remove and reorder
                            newRankings = rankings
                              .filter((r) => r.name !== opt)
                              .map((r, i) => ({ ...r, position: i + 1 }));
                          } else if (!isComplete) {
                            newRankings = [
                              ...rankings,
                              { position: nextPosition, name: opt },
                            ];
                          } else {
                            return;
                          }
                          setActivePicks((prev) => ({
                            ...prev,
                            [ept.prediction_type]: JSON.stringify(newRankings),
                          }));
                        }}
                      >
                        {/* Position badge */}
                        <span
                          className="flex items-center justify-center rounded-full font-display text-[12px]"
                          style={{
                            width: 26,
                            height: 26,
                            background: isAssigned
                              ? "var(--ps-amber)"
                              : "var(--ps-chip)",
                            color: isAssigned ? "var(--ps-surface)" : "var(--ps-text-sec)",
                            fontWeight: 800,
                          }}
                        >
                          {isAssigned ? assigned.position : ""}
                        </span>
                        <span
                          className="text-[13px] font-semibold"
                          style={{
                            color: isAssigned
                              ? "var(--ps-text)"
                              : "var(--ps-text-sec)",
                          }}
                        >
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          // ── Standard option-button types ──
          const options = getPickOptions(ept, event.event_name, event.sport);
          if (!options) return null;

          const gridCols =
            options.length <= 3
              ? `repeat(${options.length}, 1fr)`
              : "1fr";

          return (
            <div key={ept.id} className="mb-3">
              <SectionHeader
                label={`Your Pick \u00B7 ${typeLabel}`}
              />
              <div
                className="grid gap-1.5 mt-2"
                style={{ gridTemplateColumns: gridCols }}
              >
                {options.map((opt) => (
                  <PickButton
                    key={opt.id}
                    label={opt.label}
                    sub={opt.sub}
                    selected={currentPick === opt.id}
                    disabled={isLocked || submitting}
                    onClick={() =>
                      handlePick(opt.id, ept.prediction_type)
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 4. PickNote (pre-lock) ─────────────────────────────────────── */}
      {!isLocked && (
        <div className="px-4 mt-2">
          <PickNote
            initialText={userPredictions[0]?.note_text ?? ""}
            initialVisibility={userPredictions[0]?.note_visibility ?? "public"}
            onChange={(text, vis) => {
              setNoteText(text);
              setNoteVisibility(vis);
            }}
          />
        </div>
      )}

      {/* ── 5. CTA button (pre-lock) ──────────────────────────────────── */}
      {!isLocked && (
        <div className="px-4 mt-3.5 mb-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasActivePick}
            className="w-full rounded-xl py-3.5 font-extrabold disabled:opacity-60"
            style={{
              fontSize: 14.5,
              background: hasActivePick
                ? "linear-gradient(135deg, var(--ps-amber), var(--ps-amber-deep))"
                : "var(--ps-chip)",
              color: hasActivePick ? "var(--ps-text)" : undefined,
              letterSpacing: 0.4,
            }}
          >
            {submitting
              ? "Locking it in..."
              : hasActivePick
              ? "Lock it in"
              : "Pick to continue"}
          </button>
          {submitError && (
            <p className="mt-2 text-center text-[12px] font-medium text-ps-red">
              {submitError}
            </p>
          )}
          {!submitError && (
            <p className="mt-2 text-center text-[11px] text-ps-text-ter">
              You can change your pick until kickoff.
            </p>
          )}
        </div>
      )}

      {/* ── 6. Community picks (post-lock, revealed) ───────────────────── */}
      {picksRevealed && allPickRows.length > 0 && (
        <div className="px-4 mt-3.5">
          <SectionHeader
            label={`The Lads' Picks \u00B7 ${totalPicks} in`}
            accent="var(--ps-blue)"
          />

          {/* Stacked bar */}
          <div className="flex h-3.5 overflow-hidden rounded-[7px] mb-3 mt-2">
            {Object.entries(communityPredictions).map(
              ([optionLabel, group], idx) => {
                const pct =
                  totalPicks > 0
                    ? (group.count / totalPicks) * 100
                    : 0;
                return (
                  <div
                    key={optionLabel}
                    style={{
                      width: `${pct}%`,
                      background:
                        PICK_COLORS[idx % PICK_COLORS.length],
                      minWidth: pct > 0 ? 4 : 0,
                    }}
                    title={`${optionLabel}: ${group.count}`}
                  />
                );
              }
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(communityPredictions).map(
              ([optionLabel, group], idx) => (
                <div key={optionLabel} className="flex items-center gap-1.5">
                  <div
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: PICK_COLORS[idx % PICK_COLORS.length],
                    }}
                  />
                  <span
                    className="text-ps-text-sec font-semibold"
                    style={{ fontSize: 11 }}
                  >
                    {optionLabel} ({group.count})
                  </span>
                </div>
              )
            )}
          </div>

          {/* Individual pick rows */}
          {allPickRows.map((row) => (
            <div
              key={row.userId}
              className="mb-2 rounded-xl border border-ps-border bg-ps-surface p-2.5"
            >
              <div className="flex items-center gap-2.5">
                <Avatar
                  initials={row.initials}
                  color="var(--ps-amber)"
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[12.5px] font-bold text-ps-text">
                    {row.displayName}
                    {row.userId === currentUserId && (
                      <span className="text-ps-text-ter font-normal">
                        {" "}
                        (you)
                      </span>
                    )}
                  </span>
                  <div className="mt-0.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10.5px] font-extrabold"
                      style={{
                        background: row.color + "20",
                        color: row.color,
                      }}
                    >
                      {row.optionLabel}
                    </span>
                  </div>
                </div>
                <SendToThread
                  variant="icon"
                  defaultText={psDefaultPickCopy({
                    eventName: event.event_name,
                    optionLabel: row.optionLabel,
                    ownerName: row.displayName,
                  })}
                />
              </div>

              {/* PickNote (readonly) */}
              {row.note && (
                <div className="mt-2">
                  <PickNote
                    locked
                    initialText={row.note.text}
                    initialVisibility={row.note.visibility}
                    ownerIsYou={row.userId === currentUserId}
                  />
                </div>
              )}

              {/* EmojiReactions */}
              {row.predictionId && (
                <div className="mt-2">
                  <EmojiReactions
                    reactions={row.reactions}
                    onReact={(emoji) =>
                      handleReact(row.predictionId!, emoji)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 7. Intel Report ────────────────────────────────────────────── */}
      {calloutMember && (
        <div className="px-4 mt-3.5 pb-6">
          <SectionHeader label="Intel Report" />
          <div className="mt-2">
            <PersonaCallout
              calloutLabel={calloutMember.callout_label!}
              fact="The inside word from the group's resident expert."
              variant="border"
            />
          </div>
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-8" />

      {/* PWA install guide — shown after successful prediction submission on iOS */}
      {showPwaGuide && <PwaInstallGuide />}
    </div>
  );
}
