"use client";

/**
 * EmbeddedBracketKoEditor — inline knockout-round bracket editor for
 * /wc/picks/[windowId].
 *
 * Renders when the picks window's round is locked for general predictions
 * (status='locked' or 'scored') but the user's full_bracket submission is
 * still mutable. In that state the read-only "Locked" cards are unhelpful:
 * the user can no longer change their format/overall picks, but they
 * absolutely can — and should — still adjust their bracket. So we swap the
 * locked surface for the same KnockoutStageStep the wizard uses, scoped to
 * just this round.
 *
 * Writes go to /api/tournament/bracket/submit (action: save_draft). Picks
 * cascade downstream — changing an R32 winner invalidates dependent R16/QF
 * etc. picks via the shared `clearDownstreamPicks` helper, matching wizard
 * semantics.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KnockoutStageStep from "@/components/tournament/bracket/KnockoutStageStep";
import FinalStep from "@/components/tournament/bracket/FinalStep";
import { generateWC2026R32Matchups } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import {
  clearDownstreamPicks,
  getSFLoser,
  resolveAllKnockoutMatchups,
  slotIdsForRound,
} from "@/lib/tournament/bracket/wc2026-knockout-tree";
import type { BracketSubmissionData } from "@/types/tournament";

type RoundKey = "r32" | "r16" | "qf" | "sf" | "final";

const ROUND_LABEL: Record<RoundKey, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-Finals",
  sf: "Semi-Finals",
  final: "Final",
};

const NEXT_LABEL: Record<RoundKey, string | undefined> = {
  r32: "Round of 16",
  r16: "Quarter-Finals",
  qf: "Semi-Finals",
  sf: "the Final",
  final: undefined,
};

interface EmbeddedBracketKoEditorProps {
  classificationId: string;
  competitionId: string;
  roundKey: RoundKey;
  /** Ordered group rankings A→L → ['1st','2nd','3rd','4th']. */
  groupRankings: Record<string, string[]>;
  /** Existing bracket draft so we can pre-fill picks + best-third selection. */
  existingBracketData: BracketSubmissionData | null;
  /** True when fewer than 12 groups have all picks done. We render an empty
   *  state in that case rather than computing a half-broken matchup map. */
  groupsIncomplete: boolean;
}

export function EmbeddedBracketKoEditor({
  classificationId,
  competitionId,
  roundKey,
  groupRankings,
  existingBracketData,
  groupsIncomplete,
}: EmbeddedBracketKoEditorProps) {
  const [knockoutPicks, setKnockoutPicks] = useState<
    Record<string, { winner: string }>
  >(existingBracketData?.knockoutPicks ?? {});
  const [champion, setChampion] = useState(existingBracketData?.champion ?? "");
  const [thirdPlace, setThirdPlace] = useState(
    existingBracketData?.thirdPlace ?? "",
  );
  const bestThirdPicks = useMemo(
    () => existingBracketData?.bestThirdPicks ?? [],
    [existingBracketData],
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveSeq = useRef(0);

  // Bracket-data is only meaningful once R32 matchups can be generated, which
  // needs all 12 groups ranked AND 8 best-thirds picked. Anything before that
  // is a flow violation — we direct the user back to the wizard.
  const r32Matchups = useMemo(() => {
    const allGroupsRanked = Object.keys(groupRankings).length === 12;
    const thirdsValid =
      bestThirdPicks.length === 8 &&
      bestThirdPicks.every((g) => groupRankings[g]?.[2]);
    if (!allGroupsRanked || !thirdsValid) return {};
    return generateWC2026R32Matchups(groupRankings, bestThirdPicks);
  }, [groupRankings, bestThirdPicks]);

  const allMatchups = useMemo(
    () => resolveAllKnockoutMatchups(r32Matchups, knockoutPicks),
    [r32Matchups, knockoutPicks],
  );

  const persist = useCallback(
    async (bracketData: BracketSubmissionData) => {
      const seq = ++saveSeq.current;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/tournament/bracket/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classificationId,
            competitionId,
            bracketData,
            action: "save_draft",
          }),
        });
        if (saveSeq.current !== seq) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSaveError(
            (body && (body.error as string)) ?? "Couldn't save bracket pick",
          );
        } else {
          setLastSavedAt(Date.now());
        }
      } catch {
        if (saveSeq.current === seq) {
          setSaveError("Network error — bracket pick may not be saved");
        }
      } finally {
        if (saveSeq.current === seq) setSaving(false);
      }
    },
    [classificationId, competitionId],
  );

  const persistAll = useCallback(
    (
      picks: Record<string, { winner: string }>,
      championPick: string,
      thirdPlacePick: string,
    ) => {
      void persist({
        bestThirdPicks,
        knockoutPicks: picks,
        champion: championPick,
        thirdPlace: thirdPlacePick || undefined,
      });
    },
    [bestThirdPicks, persist],
  );

  const handlePick = useCallback(
    (slotId: string, winner: string) => {
      setKnockoutPicks((prev) => {
        const next = { ...prev, [slotId]: { winner } };
        clearDownstreamPicks(next, slotId);

        // Editing a SF result invalidates a previously-picked champion or
        // 3rd-place team because the finalists/SF-losers change.
        let nextChampion = champion;
        let nextThirdPlace = thirdPlace;
        if (slotId.startsWith("sf_")) {
          nextChampion = "";
          nextThirdPlace = "";
          setChampion("");
          setThirdPlace("");
        }
        if (slotId === "final") {
          nextChampion = winner;
          setChampion(winner);
        }

        persistAll(next, nextChampion, nextThirdPlace);
        return next;
      });
    },
    [champion, thirdPlace, persistAll],
  );

  const handleChampionPick = useCallback(
    (team: string) => {
      setChampion(team);
      setKnockoutPicks((prev) => {
        const next = { ...prev, final: { winner: team } };
        persistAll(next, team, thirdPlace);
        return next;
      });
    },
    [persistAll, thirdPlace],
  );

  const handleThirdPlacePick = useCallback(
    (team: string) => {
      setThirdPlace(team);
      persistAll(knockoutPicks, champion, team);
    },
    [champion, knockoutPicks, persistAll],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (groupsIncomplete) {
    return (
      <BracketHandoffCard classificationId={classificationId}>
        <p className="text-sm text-ps-text">
          Your bracket needs your group-stage picks and best-thirds ranking
          before this knockout round can be edited inline.
        </p>
      </BracketHandoffCard>
    );
  }

  if (bestThirdPicks.length !== 8) {
    return (
      <BracketHandoffCard classificationId={classificationId}>
        <p className="text-sm text-ps-text">
          Pick your 8 best third-place teams in the bracket wizard first —
          R32 matchups can&rsquo;t be computed without them.
        </p>
      </BracketHandoffCard>
    );
  }

  return (
    <div className="space-y-4">
      <BracketModeBanner
        roundLabel={ROUND_LABEL[roundKey]}
        classificationId={classificationId}
        saving={saving}
        lastSavedAt={lastSavedAt}
      />

      {saveError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-ps-red/30 bg-ps-red/5 px-3 py-2 text-xs text-ps-red"
        >
          <span className="flex-1">{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 flex h-5 w-5 items-center justify-center rounded text-base leading-none opacity-70 hover:bg-ps-red/10 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {roundKey === "final" ? (
        <FinalStep
          finalists={{
            home: knockoutPicks.sf_m1?.winner ?? "",
            away: knockoutPicks.sf_m2?.winner ?? "",
          }}
          sfLosers={{
            home: getSFLoser("sf_m1", knockoutPicks, allMatchups),
            away: getSFLoser("sf_m2", knockoutPicks, allMatchups),
          }}
          champion={champion}
          thirdPlace={thirdPlace}
          onChampionPick={handleChampionPick}
          onThirdPlacePick={handleThirdPlacePick}
          onContinue={() => {
            /* No "continue" inside the picks-page embed — bracket-only edits
             * don't progress through the wizard's step ladder. The persist
             * already happened on each pick. */
          }}
        />
      ) : (
        <KnockoutStageStep
          roundKey={roundKey}
          roundName={ROUND_LABEL[roundKey]}
          slotIds={slotIdsForRound(roundKey)}
          matchups={allMatchups}
          picks={knockoutPicks}
          nextRoundName={NEXT_LABEL[roundKey]}
          onPick={handlePick}
          onContinue={() => {
            /* Inline editor: no continue button action needed. */
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BracketModeBanner({
  roundLabel,
  classificationId,
  saving,
  lastSavedAt,
}: {
  roundLabel: string;
  classificationId: string;
  saving: boolean;
  lastSavedAt: number | null;
}) {
  return (
    <div className="rounded-xl border-2 border-ps-amber/40 bg-ps-amber/5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-amber-deep">
          Bracket edit mode
        </p>
        <span className="font-mono text-[10px] font-bold text-ps-text-ter">
          {saving ? "Saving…" : lastSavedAt ? "✓ Saved" : ""}
        </span>
      </div>
      <h2 className="mt-1 text-base font-extrabold text-ps-text">
        {roundLabel} · bracket-only
      </h2>
      <p className="mt-1 text-xs text-ps-text-sec">
        Match predictions for this round are locked for the overall &amp;
        format leaderboards, but your bracket picks are still open. Tap a
        team to update your bracket — changes save automatically.
      </p>
      <Link
        href={`/wc/bracket/wizard?classificationId=${classificationId}`}
        className="mt-2 inline-block text-xs font-semibold text-ps-amber-deep hover:underline"
      >
        Open full bracket wizard →
      </Link>
    </div>
  );
}

function BracketHandoffCard({
  classificationId,
  children,
}: {
  classificationId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 border-ps-amber/40 bg-ps-amber/5 p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-amber-deep">
        Bracket edit mode
      </p>
      <div className="mt-2">{children}</div>
      <Link
        href={`/wc/bracket/wizard?classificationId=${classificationId}`}
        className="mt-3 inline-block rounded-xl bg-ps-amber px-4 py-2 text-sm font-extrabold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Open bracket wizard →
      </Link>
    </div>
  );
}
