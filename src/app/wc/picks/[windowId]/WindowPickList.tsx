"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT, useLocale } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { ConfidencePills, ConfidenceIntroCard, ConfidenceBreadcrumb } from "@/components/ConfidencePills";
import { useConfidenceDisclosure } from "@/hooks/useConfidenceDisclosure";
import { ScoreInput } from "@/components/ScoreInput";
import { FixtureCardSurface } from "@/components/wc/FixtureCardSurface";
// TODO: re-enable ConfidenceAccordion once progressive disclosure is complete
// import { ConfidenceAccordion } from "@/components/wc/ConfidenceAccordion";
import { deriveWinnerFromScore } from "@/lib/score-format";
import { getPredictionSummary } from "@/lib/prediction-summary";
import { usePredictionState } from "@/hooks/usePredictionState";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { EventPredictionType, Prediction } from "@/types/database";

/**
 * WindowPickList — compact interactive pick UI for one World Cup matchday window.
 *
 * Each match renders as a single-row card: [Home] [Draw] [Away] with a small
 * "Exact score…" trigger underneath. The dates/times of the matches matter
 * less than fast outcome picking, so the card intentionally strips the
 * fixture header and metadata — the colour of the selected button is the
 * visual signal.
 *
 * Taps are optimistic. The W/D/L choice updates local state immediately, the
 * POST fires in the background, and only an error reverts the UI. A per-event
 * AbortController guarantees the latest tap wins if the user changes their
 * mind while a previous save is still in flight — the old behaviour of
 * disabling the buttons during save was eating taps and making the UI feel
 * dead.
 *
 * When the user lands their final pick of the window, `onWindowComplete`
 * fires once so the page can run a celebration overlay.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindowEvent {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  pick_reveal_at?: string | null;
  status: string;
  result_confirmed: boolean;
  event_prediction_types: EventPredictionType[];
}

/**
 * Visual surface for each pick row.
 *
 *  - "compact" (default): the existing cream/ink card used on
 *    /wc/picks/[windowId]. Pixel-identical to the pre-PR2 behaviour.
 *  - "card": host-city-coloured surface (FixtureCardSurface) with amber-on-
 *    color button treatment. Used by the picks-first /wc landing (PR3).
 *
 * The "card" surface requires per-event fixture metadata (city, group,
 * matchday, kickoffUtc). Pass it via `fixtureByEventId` keyed by
 * `event.id`. If the lookup misses for a given event in card mode, that row
 * falls back to the compact surface (defensive — the landing should always
 * populate this map for MD1 events).
 */
export type PickSurface = "compact" | "card";

interface WindowPickListProps {
  competitionId: string;
  events: WindowEvent[];
  /** All existing predictions for this user across the window's events. */
  predictions: Prediction[];
  /**
   * Whether the whole window is closed (round status 'locked'/'scored').
   * When true every event renders read-only, regardless of its own lock_time.
   */
  windowLocked: boolean;
  /** Fires the first time the user lands a pick that makes all matches picked. */
  onWindowComplete?: () => void;
  /** Visual surface. Defaults to "compact" — the existing /wc/picks behaviour. */
  surface?: PickSurface;
  /**
   * Required for surface="card": map of `event.id` → WcFixture so the row can
   * resolve city colour, group letter, matchday, and kickoff timestamp.
   */
  fixtureByEventId?: Map<string, WcFixture>;
  /** Show a live countdown in each card header. Used in group view where there's no per-section countdown. */
  showCardCountdown?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function splitTeams(eventName: string): { home: string; away: string } {
  for (const sep of [" vs ", " v ", " VS ", " V "]) {
    const idx = eventName.indexOf(sep);
    if (idx !== -1) {
      return {
        home: eventName.slice(0, idx).trim(),
        away: eventName.slice(idx + sep.length).trim(),
      };
    }
  }
  return { home: eventName, away: "" };
}

function winnerValue(pred: Prediction | undefined): string | null {
  if (!pred) return null;
  const d = pred.prediction_data ?? {};
  return (d.value as string) ?? (d.selection as string) ?? null;
}

/**
 * Map an option label to a button "slot". The slot drives the colour scheme:
 * home wins (left) glow amber-warm, draws (middle) glow ink-neutral, away
 * wins (right) glow amber-deep. We don't tie colour to the team name because
 * options like "Draw" are language-y rather than positional.
 */
type Slot = "home" | "draw" | "away";
function slotOf(label: string, home: string, away: string): Slot {
  if (label === home) return "home";
  if (label === away) return "away";
  return "draw";
}

// ── Single match row ─────────────────────────────────────────────────────────

/**
 * Class-string buckets per surface. Keeps the JSX free of inline branches and
 * makes it trivial to verify both paths render the right tokens.
 *
 * Card surface mirrors FixturesTabs.FixtureCard (lines 458–500): inset amber
 * outline on selected buttons against the host-city colour; white-tinted
 * backgrounds for score inputs that bind to amber when filled.
 *
 * Compact surface preserves the existing /wc/picks/[windowId] behaviour
 * verbatim — bg-ps-amber/10 + ring-ps-amber on cream.
 */
type SurfaceTheme = {
  /** Class string applied to the outer compact wrapper. Unused for card surface. */
  outerWrapper: (hasPick: boolean) => string;
  teamButton: (selected: boolean) => string;
  teamLabel: (selected: boolean) => string;
  drawButton: (selected: boolean) => string;
  scoreInput: (filled: boolean) => string;
  errorText: string;
  lockedReadOnly: string;
  lockedText: string;
  lockedPickedText: string;
  lockedMutedText: string;
};

const COMPACT_THEME: SurfaceTheme = {
  outerWrapper: (hasPick) =>
    [
      "rounded-xl border p-3.5 transition-all duration-200 bg-ps-surface",
      hasPick ? "border-ps-amber/30" : "border-ps-border",
    ].join(" "),
  teamButton: (selected) =>
    [
      "flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
      selected ? "bg-ps-amber/10 ring-2 ring-ps-amber" : "hover:bg-ps-chip",
    ].join(" "),
  teamLabel: (selected) =>
    [
      "max-w-full truncate text-xs font-semibold text-center leading-tight",
      selected ? "text-ps-amber" : "text-ps-text-ter",
    ].join(" "),
  drawButton: (selected) =>
    [
      "shrink-0 px-2.5 min-h-[44px] flex items-center rounded-lg text-xs font-medium transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
      selected
        ? "bg-ps-amber/10 text-ps-amber ring-2 ring-ps-amber"
        : "text-ps-text-ter hover:bg-ps-chip hover:text-ps-text-sec",
    ].join(" "),
  scoreInput: (filled) =>
    [
      "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-ps-text outline-none transition-all duration-150 shrink-0",
      filled ? "bg-white border-ps-amber" : "bg-transparent border-ps-border",
      "focus:border-ps-amber focus:bg-white",
    ].join(" "),
  errorText: "mt-1 text-[11px] font-medium text-ps-red",
  lockedReadOnly: "rounded-lg border border-ps-border bg-ps-surface px-3 py-2",
  lockedText: "text-sm font-semibold text-ps-text",
  lockedPickedText: "font-semibold text-ps-text",
  lockedMutedText: "text-ps-text-ter",
};

/**
 * Card-surface theme — used inside a FixtureCardSurface, so the parent supplies
 * the host-city background. All buttons sit on translucent white tints; the
 * selected state uses an inset amber outline that reads against any host-city
 * hue (lifted verbatim from FixturesTabs.FixtureCard line 461).
 */
const CARD_THEME: SurfaceTheme = {
  // Card surface uses FixtureCardSurface as the outer wrapper, so this is
  // unused — we still define a no-op to keep the type uniform.
  outerWrapper: () => "",
  teamButton: (selected) =>
    [
      "flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
      selected
        ? "bg-white/12 shadow-[inset_0_0_0_2px_rgba(212,175,55,0.45)]"
        : "hover:bg-white/10",
    ].join(" "),
  teamLabel: (selected) =>
    [
      "max-w-full truncate text-xs font-semibold text-center leading-tight",
      selected ? "text-white" : "text-white/45",
    ].join(" "),
  drawButton: (selected) =>
    [
      "shrink-0 px-2.5 min-h-[44px] flex items-center rounded-lg text-xs font-medium transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
      selected
        ? "bg-white/12 text-white shadow-[inset_0_0_0_2px_rgba(212,175,55,0.45)]"
        : "text-white/45 hover:bg-white/10 hover:text-white/65",
    ].join(" "),
  scoreInput: (filled) =>
    [
      "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-white outline-none transition-all duration-150 shrink-0 placeholder:text-white/30",
      filled ? "bg-white/18 border-ps-amber/70" : "bg-white/8 border-white/25",
      "focus:border-ps-amber/80 focus:bg-white/15",
    ].join(" "),
  errorText: "mt-1 text-[11px] font-medium text-red-200",
  // Card surface read-only state stays on the host-city background. We still
  // dim the body slightly so it reads as locked vs interactive.
  lockedReadOnly: "px-1 py-0.5 opacity-90",
  lockedText: "text-sm font-semibold text-white",
  lockedPickedText: "font-semibold text-white",
  lockedMutedText: "text-white/55",
};

function MatchPickRow({
  competitionId,
  event,
  initialPredictions,
  windowLocked,
  onWinnerLanded,
  surface = "compact",
  fixture,
  showCardCountdown,
}: {
  competitionId: string;
  event: WindowEvent;
  initialPredictions: Prediction[];
  windowLocked: boolean;
  /** Fired AFTER the optimistic state has a non-null winner. */
  onWinnerLanded: (eventId: string, hasWinner: boolean) => void;
  /** Visual surface — see SurfaceTheme above. */
  surface?: PickSurface;
  /** Required when surface="card" — supplies city, group, matchday, kickoff. */
  fixture?: WcFixture;
  /** Show countdown in card header (group view only). */
  showCardCountdown?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();

  // Resolve card-surface mode. If surface="card" was requested but no fixture
  // metadata was supplied, fall back to compact — better to degrade gracefully
  // than throw, but log so the caller can fix it.
  const useCardSurface = surface === "card" && fixture !== undefined;
  if (
    surface === "card" &&
    !fixture &&
    typeof console !== "undefined" &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production"
  ) {
    console.warn(
      `[WindowPickList] surface="card" requested for event ${event.id} but no fixture metadata supplied; falling back to compact.`,
    );
  }
  const theme = useCardSurface ? CARD_THEME : COMPACT_THEME;

  const winnerEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "winner",
  );
  const scoreEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "exact_score",
  );
  const h2hEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "head_to_head",
  );
  const isKnockout = !!h2hEpt;

  const isLocked =
    windowLocked ||
    new Date(event.lock_time) <= new Date() ||
    event.status !== "upcoming";

  const { home, away } = useMemo(
    () => splitTeams(event.event_name),
    [event.event_name],
  );

  const winnerOptions = useMemo<string[]>(() => {
    const opts = winnerEpt?.config?.options as string[] | undefined;
    if (opts && opts.length > 0) return opts;
    return away ? [home, "Draw", away] : [home];
  }, [winnerEpt, home, away]);

  const drawOption = useMemo(
    () =>
      winnerOptions.find((opt) => slotOf(opt, home, away) === "draw") ?? "Draw",
    [winnerOptions, home, away],
  );

  // Confidence progressive disclosure
  const disclosure = useConfidenceDisclosure();

  // Wrap onWinnerLanded to also track grace period for confidence disclosure
  const handleWinnerLandedWithDisclosure = useCallback(
    (eventId: string, hasWinner: boolean) => {
      if (hasWinner) disclosure.recordPrediction();
      onWinnerLanded(eventId, hasWinner);
    },
    [onWinnerLanded, disclosure],
  );

  // Prediction state hook
  const {
    currentWinner, scoreDisplay, feedback, error: errorMsg,
    scoreResetKey, resetInFlight, initialScore, confidenceLevel,
    pickWinner, commitScore, setConfidence, resetAll, clearFeedback,
  } = usePredictionState({
    initialPredictions, eventId: event.id, competitionId,
    sport: event.sport, winnerEptId: winnerEpt?.id,
    winnerOptions, scoreEptId: scoreEpt?.id,
    isLocked, onWinnerLanded: handleWinnerLandedWithDisclosure,
  });
  const handleConfidenceChange = useCallback((level: number | null) => {
    setConfidence(level);
    if (level !== null) disclosure.recordConfidenceUsed();
    else disclosure.recordConfidenceDismissed();
  }, [setConfidence, disclosure]);

  // Live score values for the hint
  const [liveScore, setLiveScore] = useState({ home: "", away: "" });
  const handleScoreChange = useCallback((h: string, a: string) => {
    setLiveScore({ home: h, away: a });
  }, []);

  const liveImpliedWinner = useMemo(() => {
    const h = parseInt(liveScore.home, 10);
    const a = parseInt(liveScore.away, 10);
    if (isNaN(h) || isNaN(a)) return null;
    return deriveWinnerFromScore({ home: h, away: a }, event.sport, winnerOptions);
  }, [liveScore, event.sport, winnerOptions]);

  const showScoreHint = liveImpliedWinner !== null && currentWinner !== null && liveImpliedWinner !== currentWinner;

  // ── Read-only locked branch ──────────────────────────────────────────────
  if (isLocked) {
    // Card surface locked state mirrors the interactive layout (centered flags
    // at 29px, team names below) so the blurred preview on the landing page
    // matches what members see. The compact inline layout is only for the
    // non-card surface.
    const lockedBody = useCardSurface ? (
      <>
        {/* Team buttons row — same layout as interactive, just non-clickable */}
        <div className="flex items-center justify-center gap-1.5">
          <div className="flex flex-1 min-w-0 flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg">
            <CountryFlag shape="pill" name={home} size={29} />
            <span
              className={`max-w-full truncate text-xs font-semibold text-center leading-tight ${currentWinner === home ? "text-white" : "text-white/55"}`}
            >
              {home}
            </span>
          </div>

          {winnerOptions.some((opt) => slotOf(opt, home, away) === "draw") && (
            <div className="shrink-0 px-2.5 min-h-[44px] flex items-center rounded-lg text-xs font-medium text-white/45">
              {t("fixtures.draw")}
            </div>
          )}

          <div className="flex flex-1 min-w-0 flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg">
            <CountryFlag shape="pill" name={away} size={29} />
            <span
              className={`max-w-full truncate text-xs font-semibold text-center leading-tight ${currentWinner === away ? "text-white" : "text-white/55"}`}
            >
              {away}
            </span>
          </div>
        </div>
        {currentWinner ? (
          <>
            <p className="mt-1 text-xs text-white/75">
              <svg
                className="inline mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              {t("wc.picked_label")}{" "}
              <span className="font-semibold text-white">{currentWinner}</span>
            </p>
            {initialScore && !resetInFlight && (
              <p className="text-[10px] text-white/55">
                {getPredictionSummary(
                  "exact_score",
                  initialScore.prediction_data,
                  home,
                  away,
                  t,
                )}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-white/55">
            <svg
              className="inline mr-1 h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            {t("wc.locked_no_prediction")}
          </p>
        )}
      </>
    ) : (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 ${theme.lockedText}`}>
            <CountryFlag shape="pill" name={home} size={18} />
            {home}
            <span className={`mx-1 ${theme.lockedMutedText}`}>v</span>
            <CountryFlag shape="pill" name={away} size={18} />
            {away}
          </span>
          <span className="rounded-full bg-ps-chip px-2 py-0.5 text-[10px] font-semibold uppercase text-ps-text-sec">
            {event.result_confirmed
              ? t("prediction.resulted")
              : t("prediction.locked")}
          </span>
        </div>
        {currentWinner ? (
          <>
            <p className={`mt-1 text-xs text-ps-text-sec`}>
              <svg
                className="inline mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              {t("wc.picked_label")}{" "}
              <span className={theme.lockedPickedText}>{currentWinner}</span>
            </p>
            {initialScore && !resetInFlight && (
              <p className={`text-[10px] text-ps-text-ter`}>
                {getPredictionSummary(
                  "exact_score",
                  initialScore.prediction_data,
                  home,
                  away,
                  t,
                )}
              </p>
            )}
          </>
        ) : (
          <p className={`mt-1 text-xs ${theme.lockedMutedText}`}>
            <svg
              className="inline mr-1 h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            {t("wc.locked_no_prediction")}
          </p>
        )}
      </>
    );

    // Compute reveal time for confidence accordion
    const confidenceRevealAt = event.pick_reveal_at
      ? event.pick_reveal_at
      : new Date(new Date(event.lock_time).getTime() + 5 * 60_000).toISOString();

    if (useCardSurface && fixture) {
      return (
        <>
          <FixtureCardSurface
            city={fixture.city}
            headerLeft={
              fixture.group && fixture.matchday
                ? t("fixtures.stage_group", {
                    group: fixture.group,
                    matchday: fixture.matchday,
                  })
                : event.event_name
            }
            headerRight={formatHeaderRight(
              fixture.kickoffUtc,
              showCardCountdown ? event.lock_time : undefined,
              event.pick_reveal_at,
              locale,
            )}
            hasPick={currentWinner !== null}
          >
            <div className={theme.lockedReadOnly}>{lockedBody}</div>
          </FixtureCardSurface>
        </>
      );
    }

    return (
      <>
        <div className={theme.lockedReadOnly}>{lockedBody}</div>
      </>
    );
  }

  // ── Conflict mode: replaces interactive body when score contradicts pick ──
  if (feedback.type === "conflict") {
    const conflictBody = (
      <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2 py-4 px-3">
        <svg className={`h-5 w-5 ${useCardSurface ? "text-red-300" : "text-ps-red"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p className={`text-[13px] font-semibold ${useCardSurface ? "text-white" : "text-ps-text"}`}>
          {t("prediction.contradiction")}
        </p>
        <p className={`text-xs text-center max-w-[260px] ${useCardSurface ? "text-white/70" : "text-ps-text-sec"}`}>
          {t("prediction.conflict_body", {
            homeScore: String(feedback.score.home),
            awayScore: String(feedback.score.away),
            serverWinner: feedback.serverWinner,
            enteredPick: feedback.enteredPick,
          })}
        </p>
        <button
          type="button"
          onClick={resetAll}
          autoFocus
          className={`w-full max-w-[240px] rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            useCardSurface
              ? "bg-red-500/80 text-white hover:bg-red-500/90"
              : "bg-ps-red text-white hover:bg-ps-red/90"
          }`}
        >
          {t("prediction.try_again")}
        </button>
      </div>
    );

    if (useCardSurface && fixture) {
      return (
        <FixtureCardSurface
          city={fixture.city}
          headerLeft={fixture.group && fixture.matchday ? `Group ${fixture.group} · MD${fixture.matchday}` : event.event_name}
          headerRight={formatHeaderRight(fixture.kickoffUtc, showCardCountdown ? event.lock_time : undefined, event.pick_reveal_at, locale)}
          hasPick={currentWinner !== null}
        >
          {conflictBody}
        </FixtureCardSurface>
      );
    }
    return (
      <div className={`${theme.outerWrapper(currentWinner !== null)} animate-[ps-shutter-conflict_1.5s_ease-out]`}>
        {conflictBody}
      </div>
    );
  }

  // ── Interactive branch ──────────────────────────────────────────────────
  const homeSelected = currentWinner === home;
  const awaySelected = currentWinner === away;
  const drawSelected = currentWinner === drawOption;

  const interactiveBody = (
    <>
      {/* Winner buttons row */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => pickWinner(home)}
          aria-pressed={homeSelected}
          className={theme.teamButton(homeSelected)}
        >
          <CountryFlag shape="pill" name={home} size={29} />
          <span className={theme.teamLabel(homeSelected)}>{home}</span>
        </button>

        {winnerOptions.some((opt) => slotOf(opt, home, away) === "draw") && (
          <button
            type="button"
            onClick={() => pickWinner(drawOption)}
            aria-pressed={drawSelected}
            className={theme.drawButton(drawSelected)}
          >
            {t("fixtures.draw")}
          </button>
        )}

        <button
          type="button"
          onClick={() => pickWinner(away)}
          aria-pressed={awaySelected}
          className={theme.teamButton(awaySelected)}
        >
          <CountryFlag shape="pill" name={away} size={29} />
          <span className={theme.teamLabel(awaySelected)}>{away}</span>
        </button>
      </div>

      {isKnockout &&
        winnerOptions.some((opt) => slotOf(opt, home, away) === "draw") && (
          <p
            className={`mt-1 text-center text-xs ${useCardSurface ? "text-white/55" : "text-ps-text-ter"}`}
          >
            Draw = goes to pens. Pick who advances below.
          </p>
        )}

      {/* Confidence level — hidden until progressive disclosure is complete
      {currentWinner && disclosure.phase !== 'invisible' && (
        disclosure.phase === 'hidden' ? (
          <ConfidenceBreadcrumb
            onRestore={disclosure.restore}
            variant={useCardSurface ? "card" : "compact"}
          />
        ) : disclosure.showIntroCard ? (
          <ConfidenceIntroCard
            variant={useCardSurface ? "card" : "compact"}
            onDismiss={() => { disclosure.markIntroduced(); disclosure.recordConfidenceDismissed(); }}
          >
            <ConfidencePills
              value={confidenceLevel}
              onChange={(level) => { handleConfidenceChange(level); if (level !== null) disclosure.markIntroduced(); }}
              variant={useCardSurface ? "card" : "compact"}
            />
          </ConfidenceIntroCard>
        ) : (
          <ConfidencePills
            value={confidenceLevel}
            onChange={handleConfidenceChange}
            variant={useCardSurface ? "card" : "compact"}
          />
        )
      )} */}

      {/* Score input row */}
      {scoreEpt && (
        <div className="mt-2 flex flex-col items-center">
          {scoreDisplay.status !== "committed" && (
            <p
              className={`mb-1 text-xs ${useCardSurface ? "text-white/55" : "text-ps-text-ter"}`}
            >
              Exact score = +3 bonus pts
            </p>
          )}
          <ScoreInput
            key={scoreResetKey}
            homeLabel={home}
            awayLabel={away}
            initialHome={
              resetInFlight
                ? undefined
                : initialScore?.prediction_data?.home != null
                  ? String(initialScore.prediction_data.home)
                  : undefined
            }
            initialAway={
              resetInFlight
                ? undefined
                : initialScore?.prediction_data?.away != null
                  ? String(initialScore.prediction_data.away)
                  : undefined
            }
            onCommit={commitScore}
            onChange={handleScoreChange}
            disabled={false}
            variant={useCardSurface ? "card" : "compact"}
          />
        </div>
      )}

      {showScoreHint && (
        <p className={`mt-1 text-center text-[11px] font-medium ${useCardSurface ? "text-amber-300" : "text-ps-amber"}`}>
          {t("prediction.score_implies", { outcome: liveImpliedWinner })}
        </p>
      )}

      {scoreDisplay.status === "committed" && (
          <p
            className={`mt-1.5 text-center text-[11px] ${useCardSurface ? "text-white/65" : "text-ps-text-sec"}`}
          >
            {getPredictionSummary(
              "exact_score",
              { home: scoreDisplay.home, away: scoreDisplay.away },
              home,
              away,
              t,
            )}
            <span
              className={`ml-1 inline-block ${useCardSurface ? "text-white/40" : "text-ps-text-ter"}`}
            >
              <svg
                className="inline h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                />
              </svg>
            </span>
          </p>
        )}

      {currentWinner && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={resetAll}
            className={`text-[11px] font-medium rounded-full border px-2.5 py-1 min-h-[28px] transition-colors ${
              useCardSurface
                ? "border-white/20 text-white/45 hover:border-red-300/50 hover:text-red-200"
                : "border-ps-border text-ps-text-ter hover:border-ps-red/40 hover:text-ps-red"
            }`}
          >
            {t("prediction.reset")}
          </button>
        </div>
      )}

      {errorMsg && <p className={theme.errorText}>{errorMsg}</p>}
    </>
  );

  const feedbackClass = feedback.type === "success" ? " animate-[ps-flash-success_0.8s_ease-out]" : "";
  const feedbackClassCard = feedback.type === "success" ? " animate-[ps-flash-success-card_0.8s_ease-out]" : "";

  if (useCardSurface && fixture) {
    return (
      <div className={feedbackClassCard || undefined} onAnimationEnd={clearFeedback}>
        <FixtureCardSurface
          city={fixture.city}
          headerLeft={
            fixture.group && fixture.matchday
              ? `Group ${fixture.group} · MD${fixture.matchday}`
              : event.event_name
          }
          headerRight={formatHeaderRight(
            fixture.kickoffUtc,
            showCardCountdown ? event.lock_time : undefined,
            event.pick_reveal_at,
            locale,
          )}
          hasPick={currentWinner !== null}
        >
          {interactiveBody}
        </FixtureCardSurface>
      </div>
    );
  }

  return (
    <div
      className={`${theme.outerWrapper(currentWinner !== null)}${feedbackClass}`}
      onAnimationEnd={clearFeedback}
    >
      {interactiveBody}
    </div>
  );
}

/**
 * Header right-side content for the card surface — kickoff time on top,
 * weekday + date below in a quieter shade. All in UTC by design; the user's
 * local-time conversion is intentionally NOT shown here (that lives on
 * /wc/results which is the canonical fixture-detail surface).
 */
function formatHeaderRight(
  kickoffUtc: string,
  lockTime?: string,
  pickRevealAt?: string | null,
  locale: string = "en",
): ReactNode {
  const d = new Date(kickoffUtc);
  const intlLocale = locale === "es" ? "es-MX" : "en-GB";
  // Omit timeZone to use the browser's local timezone — Intl handles DST
  // automatically via the IANA tz database.
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const date = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  return (
    <>
      <span className="block">{time}</span>
      <span className="block text-[0.65rem] font-medium text-white/55">
        {date}
      </span>
      {lockTime && (
        <CardCountdown
          lockTime={lockTime}
          pickRevealAt={pickRevealAt ?? undefined}
        />
      )}
    </>
  );
}

function CardCountdown({
  lockTime,
  pickRevealAt,
}: {
  lockTime: string;
  pickRevealAt?: string | null;
}) {
  const t = useT();
  const revealIso =
    pickRevealAt ??
    new Date(new Date(lockTime).getTime() + 5 * 60_000).toISOString();

  const [lockText, setLockText] = useState<string | null>(() =>
    fmtDdHhMmSs(lockTime),
  );
  const [revealText, setRevealText] = useState<string | null>(() =>
    fmtDdHhMmSs(revealIso),
  );

  useEffect(() => {
    const tick = () => {
      const lt = fmtDdHhMmSs(lockTime);
      const rt = fmtDdHhMmSs(revealIso);
      setLockText(lt);
      setRevealText(rt);
      if (!lt && !rt) clearInterval(id);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockTime, revealIso]);

  // Before lock: show lock countdown
  if (lockText) {
    return (
      <span
        className="mt-0.5 block font-mono text-[0.6rem] font-semibold tabular-nums text-white/70"
        role="timer"
        aria-live="off"
      >
        {lockText}
      </span>
    );
  }

  // Between lock and reveal: show reveal countdown
  if (revealText) {
    return (
      <span
        className="mt-0.5 block text-[0.55rem] font-semibold text-amber-300/80"
        role="timer"
        aria-live="off"
      >
        {t("rivals.picks_reveal_in", { time: revealText })}
      </span>
    );
  }

  // After reveal: nothing
  return null;
}

function fmtDdHhMmSs(target: string): string | null {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const dd = Math.floor(diff / 86400000);
  const hh = Math.floor((diff % 86400000) / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dd)}:${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// ── List ─────────────────────────────────────────────────────────────────────

export function WindowPickList({
  competitionId,
  events,
  predictions,
  windowLocked,
  onWindowComplete,
  surface = "compact",
  fixtureByEventId,
  showCardCountdown,
}: WindowPickListProps) {
  const predsByEvent = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    for (const p of predictions) {
      const list = map.get(p.event_id) ?? [];
      list.push(p);
      map.set(p.event_id, list);
    }
    return map;
  }, [predictions]);

  // Track which events have a (live or just-landed) winner pick. Used to
  // detect the "all matches picked" moment so the page can fire the
  // matchday-complete celebration.
  const initialPickedSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of predictions) {
      if (p.prediction_type === "winner" && winnerValue(p)) {
        set.add(p.event_id);
      }
    }
    return set;
  }, [predictions]);

  const [, setPickedEventIds] = useState<Set<string>>(initialPickedSet);
  const completedFiredRef = useRef(false);

  // Pickable events: live, unlocked matches in the window. The celebration
  // should fire when those are all picked — already-locked matches without a
  // pick can't be picked, so they shouldn't block completion.
  //
  // We snapshot `Date.now()` once at first render via a useState initializer
  // (the only render-safe place to call an impure function). A page reload
  // refreshes it, which is fine — windows lock on minute boundaries, not
  // tap-by-tap.
  const [nowAtMount] = useState<number>(() => Date.now());

  const pickableEventIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of events) {
      const eventLocked =
        windowLocked ||
        new Date(e.lock_time).getTime() <= nowAtMount ||
        e.status !== "upcoming";
      if (!eventLocked) ids.push(e.id);
    }
    return ids;
  }, [events, windowLocked, nowAtMount]);

  // If the user already finished the window before this mount (every pickable
  // match has a saved winner), don't fire the celebration — they're revisiting.
  useEffect(() => {
    if (pickableEventIds.length === 0) return;
    const alreadyComplete = pickableEventIds.every((id) =>
      initialPickedSet.has(id),
    );
    if (alreadyComplete) completedFiredRef.current = true;
  }, [pickableEventIds, initialPickedSet]);

  const handleWinnerLanded = useCallback(
    (eventId: string, hasWinner: boolean) => {
      setPickedEventIds((prev) => {
        const next = new Set(prev);
        if (hasWinner) next.add(eventId);
        else next.delete(eventId);

        if (
          !completedFiredRef.current &&
          pickableEventIds.length > 0 &&
          pickableEventIds.every((id) => next.has(id))
        ) {
          completedFiredRef.current = true;
          // Defer so React commits this set update before the overlay mounts.
          queueMicrotask(() => onWindowComplete?.());
        }

        return next;
      });
    },
    [pickableEventIds, onWindowComplete],
  );

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No fixtures scheduled for this window yet.
      </p>
    );
  }

  // Card surface uses a slightly larger gap so each card's halo breathes;
  // compact keeps the existing tight stack.
  const stackGap = surface === "card" ? "space-y-3" : "space-y-2";

  return (
    <div className={stackGap}>
      {events.map((event) => (
        <MatchPickRow
          key={event.id}
          competitionId={competitionId}
          event={event}
          initialPredictions={predsByEvent.get(event.id) ?? []}
          windowLocked={windowLocked}
          onWinnerLanded={handleWinnerLanded}
          surface={surface}
          fixture={fixtureByEventId?.get(event.id)}
          showCardCountdown={showCardCountdown}
        />
      ))}
    </div>
  );
}
