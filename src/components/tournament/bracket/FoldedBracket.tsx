"use client";

/**
 * FoldedBracket — poster-style summary of a user's full bracket.
 *
 * Visualises the bracket as a vertically-folded page with two sides:
 *  - Side A: Groups A–F (left column), R32 slots 1–8, R16 m1–4, QF m1–2, SF m1
 *  - Side B: Groups G–L (right column), R32 slots 9–16, R16 m5–8, QF m3–4, SF m2
 *
 * Both sides share the seam: Final + Champion. Users flip by tapping the
 * tall edge button, swiping horizontally, or pressing left/right arrows.
 *
 * Rendered on /wc/bracket once predictions exist, and at the top of the
 * wizard's review step.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import type { BracketSubmissionData } from "@/types/tournament";

type Side = "A" | "B";

interface FoldedBracketProps {
  submission: BracketSubmissionData;
  /** Group rankings — required to render Side A/B groups with finishing order. */
  groupRankings: Record<string, string[]>;
  /** R32 matchups by slot id, if known. Used to show opponents in early rounds. */
  matchups?: Record<string, { home: string; away: string }>;
  /** Optional caption above the bracket (e.g. user display name). */
  caption?: string;
}

const SIDE_A_GROUPS = ["A", "B", "C", "D", "E", "F"];
const SIDE_B_GROUPS = ["G", "H", "I", "J", "K", "L"];

// R32 splits visually: first 8 slots feed Side A's half of the bracket,
// last 8 feed Side B. FIFA's draw still crosses sides at the team level
// (e.g. 1C plays 2F in r32_m4) — that's the tournament reality and we
// show it honestly rather than rearranging.
const SIDE_A_R32 = ["r32_m1", "r32_m2", "r32_m3", "r32_m4", "r32_m5", "r32_m6", "r32_m7", "r32_m8"];
const SIDE_B_R32 = ["r32_m9", "r32_m10", "r32_m11", "r32_m12", "r32_m13", "r32_m14", "r32_m15", "r32_m16"];
const SIDE_A_R16 = ["r16_m1", "r16_m2", "r16_m3", "r16_m4"];
const SIDE_B_R16 = ["r16_m5", "r16_m6", "r16_m7", "r16_m8"];
const SIDE_A_QF = ["qf_m1", "qf_m2"];
const SIDE_B_QF = ["qf_m3", "qf_m4"];

export function FoldedBracket({
  submission,
  groupRankings,
  matchups = {},
  caption,
}: FoldedBracketProps) {
  const [side, setSide] = useState<Side>("A");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Keyboard: left/right arrows flip when the bracket has focus.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSide("B");
      else if (e.key === "ArrowLeft") setSide("A");
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, []);

  // Touch: horizontal swipe (>40px and dominantly horizontal) flips sides.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (sx == null || sy == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) setSide("B");
    else setSide("A");
  };

  return (
    <div className="relative">
      {/* FIFA WC 2026 mark is rendered by the page-level WcBrandedTitle —
          see design/DESIGN-RULES.md § "WC Branded Title". */}
      <div
        ref={wrapperRef}
        tabIndex={0}
        role="region"
        aria-label={`Bracket poster, showing side ${side}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative overflow-hidden rounded-2xl border border-ps-border bg-ps-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber"
      >
        {/* Caption (display name) */}
        {caption && (
          <div className="border-b border-ps-border bg-ps-bg/60 px-4 py-2 text-center">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
              {caption}
            </span>
          </div>
        )}

        {/* Slider: 200% wide, two sides */}
        <div
          className="flex w-[200%] transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: side === "A" ? "translateX(0)" : "translateX(-50%)" }}
          aria-live="polite"
        >
          <BracketSide
            sideLabel="A"
            groupIds={SIDE_A_GROUPS}
            r32Slots={SIDE_A_R32}
            r16Slots={SIDE_A_R16}
            qfSlots={SIDE_A_QF}
            sfSlot="sf_m1"
            submission={submission}
            groupRankings={groupRankings}
            matchups={matchups}
          />
          <BracketSide
            sideLabel="B"
            groupIds={SIDE_B_GROUPS}
            r32Slots={SIDE_B_R32}
            r16Slots={SIDE_B_R16}
            qfSlots={SIDE_B_QF}
            sfSlot="sf_m2"
            submission={submission}
            groupRankings={groupRankings}
            matchups={matchups}
            // Mirror layout so groups sit on the right and bracket flows from right→left
            mirrored
          />
        </div>

        {/* Vertical flip control — anchored to the seam edge of the visible side */}
        <button
          type="button"
          onClick={() => setSide(side === "A" ? "B" : "A")}
          aria-label={side === "A" ? "Show side B (Groups G–L)" : "Show side A (Groups A–F)"}
          className={`group absolute top-1/2 z-10 flex h-28 w-7 -translate-y-1/2 items-center justify-center rounded-l-full rounded-r-full bg-ps-amber text-ps-bg shadow-lg ring-1 ring-ps-amber/40 transition-all active:scale-95 ${
            side === "A" ? "right-0 -translate-x-0" : "left-0 translate-x-0"
          }`}
        >
          <span className="sr-only">{side === "A" ? "Next side" : "Previous side"}</span>
          {/* Vertical label */}
          <span
            aria-hidden
            className="flex flex-col items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest"
          >
            {side === "A" ? (
              <>
                <Chevron direction="right" />
                <span style={{ writingMode: "vertical-rl" }}>Side B</span>
              </>
            ) : (
              <>
                <span style={{ writingMode: "vertical-rl" }} className="rotate-180">
                  Side A
                </span>
                <Chevron direction="left" />
              </>
            )}
          </span>
        </button>

        {/* Side indicator dots */}
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-all ${
              side === "A" ? "w-4 bg-ps-amber" : "bg-ps-border-strong"
            }`}
          />
          <span
            className={`h-1.5 w-1.5 rounded-full transition-all ${
              side === "B" ? "w-4 bg-ps-amber" : "bg-ps-border-strong"
            }`}
          />
        </div>
      </div>

      {/* Champion seam — visible always */}
      <ChampionSeam
        champion={submission.champion}
        runnerUp={
          submission.champion
            ? [submission.knockoutPicks?.sf_m1?.winner, submission.knockoutPicks?.sf_m2?.winner]
                .find((t) => t && t !== submission.champion)
            : undefined
        }
        thirdPlace={submission.thirdPlace}
      />

      {/* Hint */}
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-ps-text-ter">
        Swipe or tap the tab to flip
      </p>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BracketSideProps {
  sideLabel: Side;
  groupIds: string[];
  r32Slots: string[];
  r16Slots: string[];
  qfSlots: string[];
  sfSlot: string;
  submission: BracketSubmissionData;
  groupRankings: Record<string, string[]>;
  matchups: Record<string, { home: string; away: string }>;
  mirrored?: boolean;
}

function BracketSide({
  sideLabel,
  groupIds,
  r32Slots,
  r16Slots,
  qfSlots,
  sfSlot,
  submission,
  groupRankings,
  matchups,
  mirrored = false,
}: BracketSideProps) {
  return (
    <div className="w-1/2 shrink-0 px-3 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Side {sideLabel}
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          {groupIds[0]}–{groupIds[groupIds.length - 1]}
        </span>
      </div>

      <div className={`flex gap-2 ${mirrored ? "flex-row-reverse" : ""}`}>
        {/* Groups column */}
        <div className="flex w-[42%] flex-col gap-1.5">
          {groupIds.map((groupId) => (
            <GroupCard
              key={groupId}
              groupId={groupId}
              ranking={groupRankings[groupId] ?? []}
              qualifyingThirds={submission.bestThirdPicks ?? []}
            />
          ))}
        </div>

        {/* Bracket column — 4 rounds stacked R32 → R16 → QF → SF */}
        <div className="flex flex-1 flex-col justify-between gap-1">
          <BracketColumn
            label="R32"
            slots={r32Slots}
            picks={submission.knockoutPicks}
            matchups={matchups}
            compact
          />
          <BracketColumn
            label="R16"
            slots={r16Slots}
            picks={submission.knockoutPicks}
            matchups={matchups}
          />
          <BracketColumn
            label="QF"
            slots={qfSlots}
            picks={submission.knockoutPicks}
            matchups={matchups}
          />
          <BracketColumn
            label="SF"
            slots={[sfSlot]}
            picks={submission.knockoutPicks}
            matchups={matchups}
          />
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  groupId,
  ranking,
  qualifyingThirds,
}: {
  groupId: string;
  ranking: string[];
  qualifyingThirds: string[];
}) {
  // The full group roster, so we render 4 rows even if some rankings are
  // empty mid-draft.
  const fullRoster = useMemo(
    () => WC2026_GROUPS.find((g) => g.groupId === groupId)?.teams ?? [],
    [groupId],
  );
  const teams = ranking.length === 4 ? ranking : fullRoster;
  const thirdQualifies = qualifyingThirds.includes(groupId);

  return (
    <div className="rounded-md border border-ps-border bg-ps-bg p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ps-text-ter">
          Grp {groupId}
        </span>
        {ranking.length === 4 && (
          <span className="font-mono text-[8px] font-bold text-ps-green">✓</span>
        )}
      </div>
      <ol className="space-y-0.5">
        {teams.slice(0, 4).map((team, i) => {
          const colour =
            i < 2
              ? "text-ps-text font-semibold"
              : i === 2
                ? thirdQualifies
                  ? "text-ps-amber font-semibold"
                  : "text-ps-text-ter"
                : "text-ps-text-ter line-through decoration-ps-text-ter/60";
          return (
            <li key={`${team}-${i}`} className={`flex items-center gap-1 text-[10px] ${colour}`}>
              <span className="font-mono w-2 shrink-0">{i + 1}</span>
              <CountryFlag shape="pill" name={team} size={10} />
              <span className="truncate">{team}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BracketColumn({
  label,
  slots,
  picks,
  matchups,
  compact = false,
}: {
  label: string;
  slots: string[];
  picks: Record<string, { winner: string }>;
  matchups: Record<string, { home: string; away: string }>;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ps-text-ter">
        {label}
      </p>
      <div className={`flex flex-col ${compact ? "gap-0.5" : "gap-1"}`}>
        {slots.map((slotId) => {
          const winner = picks[slotId]?.winner;
          const matchup = matchups[slotId];
          return (
            <div
              key={slotId}
              className="rounded border border-ps-border bg-ps-bg px-1.5 py-0.5"
            >
              {winner ? (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-ps-text">
                  <CountryFlag shape="pill" name={winner} size={10} />
                  <span className="truncate">{winner}</span>
                </div>
              ) : matchup ? (
                <div className="text-[9px] text-ps-text-ter">
                  <span className="truncate">{matchup.home || "?"}</span>
                  <span className="mx-1 opacity-50">v</span>
                  <span className="truncate">{matchup.away || "?"}</span>
                </div>
              ) : (
                <div className="text-[9px] text-ps-text-ter">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChampionSeam({
  champion,
  runnerUp,
  thirdPlace,
}: {
  champion: string | undefined;
  runnerUp: string | undefined;
  thirdPlace: string | undefined;
}) {
  if (!champion && !runnerUp && !thirdPlace) return null;
  return (
    <div className="mt-3 rounded-xl border-2 border-ps-amber/40 bg-gradient-to-br from-ps-amber/10 to-ps-amber/5 px-4 py-3 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-amber">
        Final → Champion
      </p>
      {champion ? (
        <p className="mt-1 flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-ps-text">
          <CountryFlag shape="pill" name={champion} size={28} />
          <span>{champion}</span>
        </p>
      ) : (
        <p className="mt-1 font-display text-lg font-extrabold text-ps-text-ter">
          Champion TBD
        </p>
      )}
      {runnerUp && (
        <p className="mt-1 font-mono text-[10px] text-ps-text-sec">
          Runner-up: <span className="font-semibold text-ps-text">{runnerUp}</span>
        </p>
      )}
      {thirdPlace && (
        <p className="mt-1 font-mono text-[10px] text-ps-text-sec">
          3rd place: <span className="font-semibold text-ps-text">{thirdPlace}</span>
        </p>
      )}
    </div>
  );
}
