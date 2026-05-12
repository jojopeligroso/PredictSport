"use client";

/*
 * RoundBuilder — 3-step wizard for creating rounds with fixtures.
 *
 * Usage:
 *   <RoundBuilder
 *     competitionId="comp-123"
 *     nextRoundNumber={4}
 *     scoringRules={{ points: { winner: 10, margin: 20 }, partial_credit: true, partial_points: { margin: 10 } }}
 *     onSuccess={() => router.refresh()}
 *     onCancel={() => setShowBuilder(false)}
 *   />
 */

import { useState, useMemo } from "react";
import { FixtureBrowser } from "./FixtureBrowser";
import type { NormalizedFixture } from "./FixtureBrowser";
import { CardBasedConfig } from "./PredictionCards";
import type { PredictionTypeConfig as CardPredictionTypeConfig } from "./PredictionCards";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoundBuilderProps {
  competitionId: string;
  nextRoundNumber: number;
  scoringRules: Record<string, unknown>;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SearchResult {
  externalId: string;
  name: string;
  sport: string;
  league?: string;
  startTime: string;
  venue?: string;
  homeTeam?: string;
  awayTeam?: string;
}

type PredictionTypeName =
  | "winner"
  | "yes_no"
  | "margin"
  | "over_under"
  | "head_to_head"
  | "top_n"
  | "handicap"
  | "progression"
  | "final_standings";

interface PredictionTypeConfig {
  type: PredictionTypeName;
  points: number;
  partial_points?: number;
  config?: Record<string, unknown>;
}

interface FixtureConfig {
  fixture: SearchResult;
  predictionTypes: PredictionTypeConfig[];
  useCustom: boolean; // if true, override global defaults for this fixture
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽",
  football: "⚽",
  formula_1: "🏎",
  f1: "🏎",
  gaa: "🇮🇪",
  gaelic_football: "🏐",
  hurling: "🏑",
  golf: "⛳",
  rugby: "🏉",
  tennis: "🎾",
  horse_racing: "🏇",
  snooker: "🎱",
  mlb: "⚾",
  baseball: "⚾",
  nfl: "🏈",
  nba: "🏀",
  basketball: "🏀",
  nhl: "🏒",
  hockey: "🏒",
};


const ALL_PREDICTION_TYPES: PredictionTypeName[] = [
  "winner",
  "yes_no",
  "margin",
  "over_under",
  "head_to_head",
  "top_n",
  "handicap",
  "progression",
  "final_standings",
];

const PREDICTION_TYPE_LABELS: Record<PredictionTypeName, string> = {
  winner: "Winner",
  yes_no: "Yes / No",
  margin: "Margin",
  over_under: "Over / Under",
  head_to_head: "Head to Head",
  top_n: "Top N",
  handicap: "Handicap",
  progression: "Progression",
  final_standings: "Final Standings",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sportEmoji(sport: string): string {
  return SPORT_EMOJIS[sport.toLowerCase()] ?? "🏆";
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "TBC";
  return date.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function subtractMinutes(isoString: string, minutes: number): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function getDefaultPoints(
  scoringRules: Record<string, unknown>
): Record<PredictionTypeName, number> {
  const pts = (scoringRules.points ?? {}) as Record<string, unknown>;
  const result: Record<PredictionTypeName, number> = {
    winner: 0,
    yes_no: 0,
    margin: 0,
    over_under: 0,
    head_to_head: 0,
    top_n: 0,
    handicap: 0,
    progression: 0,
    final_standings: 0,
  };
  for (const key of ALL_PREDICTION_TYPES) {
    const val = pts[key];
    if (typeof val === "number" && val > 0) {
      result[key] = val;
    }
  }
  return result;
}

function getDefaultPartialPoints(
  scoringRules: Record<string, unknown>
): Record<PredictionTypeName, number | undefined> {
  const pp = (scoringRules.partial_points ?? {}) as Record<string, unknown>;
  const result: Record<PredictionTypeName, number | undefined> = {
    winner: undefined,
    yes_no: undefined,
    margin: undefined,
    over_under: undefined,
    head_to_head: undefined,
    top_n: undefined,
    handicap: undefined,
    progression: undefined,
    final_standings: undefined,
  };
  for (const key of ALL_PREDICTION_TYPES) {
    const val = pp[key];
    if (typeof val === "number") result[key] = val;
  }
  return result;
}

function buildDefaultPredictionTypes(
  scoringRules: Record<string, unknown>
): PredictionTypeConfig[] {
  const pts = getDefaultPoints(scoringRules);
  const partial = getDefaultPartialPoints(scoringRules);
  return ALL_PREDICTION_TYPES.filter((t) => pts[t] > 0).map((t) => ({
    type: t,
    points: pts[t],
    partial_points: partial[t],
  }));
}

/**
 * Determines which prediction types are valid for a given fixture
 * based on its structure (2-team vs multi-competitor).
 */
function getValidPredictionTypes(fixture: SearchResult): PredictionTypeName[] {
  const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);

  if (isTwoTeam) {
    // Head-to-head sports (rugby, soccer, GAA, NFL, NBA, etc.)
    return ["head_to_head", "margin", "over_under", "handicap", "yes_no"];
  } else {
    // Multi-competitor sports (F1, golf, tournaments)
    return ["winner", "top_n", "final_standings", "progression", "yes_no"];
  }
}

/**
 * Determines if a sport allows draws in head-to-head matches.
 */
function allowsDraws(sport: string): boolean {
  const drawSports = ["soccer", "rugby", "gaa", "hockey", "nhl"];
  return drawSports.includes(sport.toLowerCase());
}

/**
 * Returns the primary/default prediction type for a fixture.
 * This is the type that should be selected by default when creating a round.
 */
function getPrimaryPredictionType(fixture: SearchResult): PredictionTypeName {
  const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);
  return isTwoTeam ? "head_to_head" : "winner";
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-4 w-4"}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 8.5l4 4 7-8" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-4 w-4 animate-spin"}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-3.5 w-3.5"}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-3.5 w-3.5"} viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}


// ── Step Indicator ────────────────────────────────────────────────────────────

const STEPS = ["Find Fixtures", "Configure", "Review & Save"] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-ps-amber text-[#1a1208]"
                  : done
                  ? "bg-ps-green-soft text-ps-green"
                  : "text-ps-text-ter"
              }`}
            >
              {done ? (
                <CheckIcon className="h-3 w-3" />
              ) : (
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? "bg-[#1a1208]/20" : "bg-ps-chip"
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-4 shrink-0 transition-colors ${
                  done ? "bg-ps-green" : "bg-ps-border"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Step 1: Find Fixtures ─────────────────────────────────────────────────────

interface Step1Props {
  selected: SearchResult[];
  onSelectionChange: (fixtures: SearchResult[]) => void;
  onNext: () => void;
  onCancel: () => void;
}

function Step1FindFixtures({
  selected,
  onSelectionChange,
  onNext,
  onCancel,
}: Step1Props) {
  const selectedIdSet = useMemo(
    () => new Set(selected.map((f) => f.externalId)),
    [selected]
  );

  function handleFixtureSelect(fixture: NormalizedFixture) {
    const sr: SearchResult = {
      externalId: fixture.external_event_id,
      name: fixture.event_name,
      sport: fixture.sport,
      league: fixture.competition_name ?? undefined,
      startTime: fixture.start_time,
      homeTeam: fixture.participants?.[0] ?? undefined,
      awayTeam: fixture.participants?.[1] ?? undefined,
    };
    if (selectedIdSet.has(sr.externalId)) {
      onSelectionChange(selected.filter((f) => f.externalId !== sr.externalId));
    } else {
      onSelectionChange([...selected, sr]);
    }
  }

  return (
    <div className="space-y-4">
      <FixtureBrowser onSelect={handleFixtureSelect} selectedIds={selectedIdSet} />

      {/* Selected fixtures tray */}
      {selected.length > 0 && (
        <div className="rounded-2xl border border-ps-amber bg-ps-amber-soft">
          <div className="flex items-center justify-between border-b border-ps-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ps-amber-deep">
              Selected fixtures
            </span>
            <span className="rounded-full bg-ps-amber px-3 py-1 text-xs font-bold text-white">
              {selected.length}
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {selected.map((fixture) => (
              <div
                key={fixture.externalId}
                className="flex items-center gap-3 border-b border-ps-border px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ps-text">
                    {fixture.homeTeam && fixture.awayTeam
                      ? `${fixture.homeTeam} vs ${fixture.awayTeam}`
                      : fixture.name}
                  </div>
                  <div className="mt-0.5 text-xs text-ps-text-ter">
                    {formatDateTime(fixture.startTime)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSelectionChange(
                      selected.filter((f) => f.externalId !== fixture.externalId)
                    )
                  }
                  className="shrink-0 rounded p-0.5 text-ps-text-ter hover:text-ps-text"
                  aria-label={`Remove ${fixture.name}`}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-ps-border px-4 py-2 text-sm text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <span className="text-sm font-semibold text-ps-amber-deep">
              {selected.length} fixture{selected.length !== 1 ? "s" : ""} selected
            </span>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={selected.length === 0}
            className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-2 text-sm font-semibold text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Configure Prediction Types ────────────────────────────────────────

interface Step2Props {
  fixtureConfigs: FixtureConfig[];
  onConfigChange: (configs: FixtureConfig[]) => void;
  scoringRules: Record<string, unknown>;
  onBack: () => void;
  onNext: () => void;
}

function Step2Configure({
  fixtureConfigs,
  onConfigChange,
  scoringRules,
  onBack,
  onNext,
}: Step2Props) {
  const defaultPoints = getDefaultPoints(scoringRules);
  const defaultPartial = getDefaultPartialPoints(scoringRules);

  // Feature flag for card-based UI (Phase 2)
  const [useCardUI, setUseCardUI] = useState(true);

  // Determine valid prediction types based on fixture structure
  const validTypes = useMemo(() => {
    if (fixtureConfigs.length === 0) return ALL_PREDICTION_TYPES;
    // Use first fixture as reference for detecting event type
    return getValidPredictionTypes(fixtureConfigs[0].fixture);
  }, [fixtureConfigs]);

  // Global "apply to all" state — mirrors what's in fixtureConfigs[0] for non-custom fixtures
  const [globalTypes, setGlobalTypes] = useState<
    Record<PredictionTypeName, boolean>
  >(() => {
    const first = fixtureConfigs[0];
    if (!first) {
      return ALL_PREDICTION_TYPES.reduce(
        (acc, t) => ({ ...acc, [t]: defaultPoints[t] > 0 }),
        {} as Record<PredictionTypeName, boolean>
      );
    }
    // Only enable the primary prediction type by default (head_to_head for 2-team, winner for multi-competitor)
    const primaryType = getPrimaryPredictionType(first.fixture);
    const allowedTypes = getValidPredictionTypes(first.fixture);
    return allowedTypes.reduce(
      (acc, t) => ({ ...acc, [t]: t === primaryType }),
      {} as Record<PredictionTypeName, boolean>
    );
  });

  const [globalPointsOverride, setGlobalPointsOverride] = useState<
    Partial<Record<PredictionTypeName, number>>
  >({});

  const [expandedFixtures, setExpandedFixtures] = useState<Set<string>>(
    new Set()
  );

  // Apply global changes to all non-custom fixtures
  function applyGlobalToAll(
    types: Record<PredictionTypeName, boolean>,
    pointsOverride: Partial<Record<PredictionTypeName, number>>
  ) {
    const newConfigs = fixtureConfigs.map((fc) => {
      if (fc.useCustom) return fc;
      const predictionTypes: PredictionTypeConfig[] = validTypes.filter(
        (t) => types[t]
      ).map((t) => ({
        type: t,
        points: pointsOverride[t] ?? defaultPoints[t],
        partial_points: defaultPartial[t],
      }));
      return { ...fc, predictionTypes };
    });
    onConfigChange(newConfigs);
  }

  function handleGlobalTypeToggle(t: PredictionTypeName) {
    const next = { ...globalTypes, [t]: !globalTypes[t] };
    setGlobalTypes(next);
    applyGlobalToAll(next, globalPointsOverride);
  }

  function handleGlobalPointsChange(t: PredictionTypeName, val: number) {
    const next = { ...globalPointsOverride, [t]: val };
    setGlobalPointsOverride(next);
    applyGlobalToAll(globalTypes, next);
  }

  function toggleExpanded(externalId: string) {
    setExpandedFixtures((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  function handleFixtureTypeToggle(
    fixtureIdx: number,
    t: PredictionTypeName
  ) {
    const fc = fixtureConfigs[fixtureIdx];
    const existing = new Set(fc.predictionTypes.map((p) => p.type));
    let newTypes: PredictionTypeConfig[];
    if (existing.has(t)) {
      newTypes = fc.predictionTypes.filter((p) => p.type !== t);
    } else {
      newTypes = [
        ...fc.predictionTypes,
        {
          type: t,
          points:
            globalPointsOverride[t] ?? defaultPoints[t] > 0
              ? globalPointsOverride[t] ?? defaultPoints[t]
              : 10,
          partial_points: defaultPartial[t],
        },
      ];
    }
    const newConfigs = [...fixtureConfigs];
    newConfigs[fixtureIdx] = { ...fc, predictionTypes: newTypes, useCustom: true };
    onConfigChange(newConfigs);
  }

  function handleFixturePointsChange(
    fixtureIdx: number,
    t: PredictionTypeName,
    val: number
  ) {
    const fc = fixtureConfigs[fixtureIdx];
    const newTypes = fc.predictionTypes.map((p) =>
      p.type === t ? { ...p, points: val } : p
    );
    const newConfigs = [...fixtureConfigs];
    newConfigs[fixtureIdx] = { ...fc, predictionTypes: newTypes, useCustom: true };
    onConfigChange(newConfigs);
  }

  function resetFixtureToGlobal(fixtureIdx: number) {
    const newConfigs = [...fixtureConfigs];
    const predictionTypes: PredictionTypeConfig[] = ALL_PREDICTION_TYPES.filter(
      (t) => globalTypes[t]
    ).map((t) => ({
      type: t,
      points: globalPointsOverride[t] ?? defaultPoints[t],
      partial_points: defaultPartial[t],
    }));
    newConfigs[fixtureIdx] = {
      ...newConfigs[fixtureIdx],
      predictionTypes,
      useCustom: false,
    };
    onConfigChange(newConfigs);
  }

  const activeGlobalTypes = validTypes.filter((t) => globalTypes[t]);

  return (
    <div className="space-y-4">
      {/* UI Toggle (dev/testing) */}
      <div className="rounded-lg border border-ps-amber bg-ps-amber-soft p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ps-amber-deep">
              Phase 2: Card UI (Testing)
            </p>
            <p className="text-xs text-ps-text-sec">
              Toggle between card and checkbox UI for per-fixture customization
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUseCardUI(!useCardUI)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              useCardUI
                ? "bg-ps-amber text-[#1a1208]"
                : "border border-ps-border bg-ps-bg text-ps-text"
            }`}
          >
            {useCardUI ? "Cards ON" : "Cards OFF"}
          </button>
        </div>
      </div>

      {/* Apply to all panel */}
      <div className="rounded-2xl border border-ps-border bg-ps-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-ps-text">
          Apply to all fixtures
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {validTypes.map((t) => {
            const enabled = globalTypes[t];
            const pts =
              globalPointsOverride[t] ??
              (defaultPoints[t] > 0 ? defaultPoints[t] : undefined);
            return (
              <div
                key={t}
                className={`rounded-xl border p-2.5 transition-colors ${
                  enabled
                    ? "border-ps-amber bg-ps-amber-soft"
                    : "border-ps-border bg-ps-bg"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleGlobalTypeToggle(t)}
                    className="h-3.5 w-3.5 rounded accent-ps-amber"
                  />
                  <span
                    className={`text-xs font-medium ${
                      enabled ? "text-ps-amber-deep" : "text-ps-text-sec"
                    }`}
                  >
                    {PREDICTION_TYPE_LABELS[t]}
                  </span>
                </label>
                {enabled && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={pts ?? ""}
                      onChange={(e) =>
                        handleGlobalPointsChange(t, Number(e.target.value))
                      }
                      placeholder="pts"
                      className="w-full rounded-lg border border-ps-border bg-ps-surface px-2 py-1 text-xs text-ps-text focus:border-ps-amber focus:outline-none"
                      aria-label={`Points for ${PREDICTION_TYPE_LABELS[t]}`}
                    />
                    <span className="shrink-0 text-[10px] text-ps-text-ter">
                      pts
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {activeGlobalTypes.length === 0 && (
          <p className="mt-2 text-xs text-ps-red">
            Select at least one prediction type.
          </p>
        )}
      </div>

      {/* Per-fixture list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ps-text">
          Fixtures ({fixtureConfigs.length})
        </h3>
        {fixtureConfigs.map((fc, idx) => {
          const isExpanded = expandedFixtures.has(fc.fixture.externalId);
          const enabledTypes = new Set(fc.predictionTypes.map((p) => p.type));
          return (
            <div
              key={fc.fixture.externalId}
              className={`rounded-2xl border transition-colors ${
                fc.useCustom
                  ? "border-ps-border-strong bg-ps-surface"
                  : "border-ps-border bg-ps-surface"
              }`}
            >
              {/* Fixture header */}
              <button
                type="button"
                onClick={() => toggleExpanded(fc.fixture.externalId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-expanded={isExpanded}
              >
                <span aria-hidden="true">{sportEmoji(fc.fixture.sport)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ps-text">
                    {fc.fixture.homeTeam && fc.fixture.awayTeam
                      ? `${fc.fixture.homeTeam} vs ${fc.fixture.awayTeam}`
                      : fc.fixture.name}
                  </p>
                  <p className="text-xs text-ps-text-ter">
                    {formatDateTime(fc.fixture.startTime)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {fc.useCustom && (
                    <span className="rounded-full bg-ps-chip px-2 py-px text-[10px] font-medium text-ps-text-sec">
                      Custom
                    </span>
                  )}
                  <div className="flex flex-wrap justify-end gap-1">
                    {fc.predictionTypes.slice(0, 3).map((p) => (
                      <span
                        key={p.type}
                        className="rounded-full bg-ps-amber-soft px-1.5 py-px text-[10px] text-ps-amber-deep"
                      >
                        {PREDICTION_TYPE_LABELS[p.type]}
                      </span>
                    ))}
                    {fc.predictionTypes.length > 3 && (
                      <span className="rounded-full bg-ps-chip px-1.5 py-px text-[10px] text-ps-text-ter">
                        +{fc.predictionTypes.length - 3}
                      </span>
                    )}
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-ps-text-ter transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Expanded customisation */}
              {isExpanded && (
                <div className="border-t border-ps-border px-4 pb-4 pt-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-ps-text-sec">
                      Override prediction types for this fixture
                    </p>
                    {fc.useCustom && (
                      <button
                        type="button"
                        onClick={() => resetFixtureToGlobal(idx)}
                        className="text-xs text-ps-amber-deep underline hover:no-underline"
                      >
                        Reset to global
                      </button>
                    )}
                  </div>

                  {/* Card-based UI (Phase 2) */}
                  {useCardUI ? (
                    <CardBasedConfig
                      fixture={{
                        homeTeam: fc.fixture.homeTeam,
                        awayTeam: fc.fixture.awayTeam,
                        sport: fc.fixture.sport,
                        name: fc.fixture.name,
                      }}
                      initialConfigs={fc.predictionTypes as CardPredictionTypeConfig[]}
                      defaultPoints={{
                        head_to_head: defaultPoints.head_to_head,
                        winner: defaultPoints.winner,
                        margin: defaultPoints.margin,
                        over_under: defaultPoints.over_under,
                        handicap: defaultPoints.handicap,
                        top_n: defaultPoints.top_n,
                        final_standings: defaultPoints.final_standings,
                        progression: defaultPoints.progression,
                        yes_no: defaultPoints.yes_no,
                      }}
                      onChange={(configs) => {
                        const newConfigs = [...fixtureConfigs];
                        newConfigs[idx] = {
                          ...newConfigs[idx],
                          predictionTypes: configs.map((c) => ({
                            type: c.type as PredictionTypeName,
                            points: c.points,
                            partial_points: c.partial_points,
                            config: c.config,
                          })),
                          useCustom: true,
                        };
                        onConfigChange(newConfigs);
                      }}
                    />
                  ) : (
                    /* Checkbox grid UI (legacy/fallback) */
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {getValidPredictionTypes(fc.fixture).map((t) => {
                        const enabled = enabledTypes.has(t);
                        const pts = fc.predictionTypes.find(
                          (p) => p.type === t
                        )?.points;
                        return (
                          <div
                            key={t}
                            className={`rounded-xl border p-2.5 transition-colors ${
                              enabled
                                ? "border-ps-amber bg-ps-amber-soft"
                                : "border-ps-border bg-ps-bg"
                            }`}
                          >
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => handleFixtureTypeToggle(idx, t)}
                                className="h-3.5 w-3.5 rounded accent-ps-amber"
                              />
                              <span
                                className={`text-xs font-medium ${
                                  enabled
                                    ? "text-ps-amber-deep"
                                    : "text-ps-text-sec"
                                }`}
                              >
                                {PREDICTION_TYPE_LABELS[t]}
                              </span>
                            </label>
                            {enabled && pts !== undefined && (
                              <div className="mt-1.5 flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={pts}
                                  onChange={(e) =>
                                    handleFixturePointsChange(
                                      idx,
                                      t,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full rounded-lg border border-ps-border bg-ps-surface px-2 py-1 text-xs text-ps-text focus:border-ps-amber focus:outline-none"
                                  aria-label={`Points for ${PREDICTION_TYPE_LABELS[t]}`}
                                />
                                <span className="shrink-0 text-[10px] text-ps-text-ter">
                                  pts
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-ps-border px-4 py-2 text-sm text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={activeGlobalTypes.length === 0}
          className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-2 text-sm font-semibold text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Name & Save ───────────────────────────────────────────────────────

interface Step3Props {
  competitionId: string;
  nextRoundNumber: number;
  fixtureConfigs: FixtureConfig[];
  scoringRules: Record<string, unknown>;
  onBack: () => void;
  onSuccess: () => void;
}

function Step3Review({
  competitionId,
  nextRoundNumber,
  fixtureConfigs,
  onBack,
  onSuccess,
}: Step3Props) {
  const [roundName, setRoundName] = useState(
    `Round ${nextRoundNumber}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Totals for review summary
  const totalFixtures = fixtureConfigs.length;
  const allPredictionTypes = new Set<string>();
  let totalPossiblePoints = 0;
  fixtureConfigs.forEach((fc) => {
    fc.predictionTypes.forEach((p) => {
      allPredictionTypes.add(p.type);
      totalPossiblePoints += p.points;
    });
  });

  async function handleCreate() {
    if (!roundName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const events = fixtureConfigs.map((fc) => {
        const lockTime = subtractMinutes(fc.fixture.startTime, 5);
        return {
          event_name:
            fc.fixture.homeTeam && fc.fixture.awayTeam
              ? `${fc.fixture.homeTeam} vs ${fc.fixture.awayTeam}`
              : fc.fixture.name,
          sport: fc.fixture.sport,
          start_time: fc.fixture.startTime,
          lock_time: lockTime,
          external_event_id: fc.fixture.externalId || undefined,
          prediction_type_configs: fc.predictionTypes.map((p) => ({
            prediction_type: p.type,
            points: p.points,
            ...(p.partial_points !== undefined
              ? { partial_points: p.partial_points }
              : {}),
            ...(p.config ? { config: p.config } : {}),
          })),
        };
      });

      const body = {
        competition_id: competitionId,
        round_number: nextRoundNumber,
        name: roundName.trim(),
        events,
      };

      const res = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create round");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Round name */}
      <div className="space-y-1.5">
        <label
          htmlFor="round-name"
          className="text-sm font-medium text-ps-text"
        >
          Round name
        </label>
        <input
          id="round-name"
          type="text"
          value={roundName}
          onChange={(e) => setRoundName(e.target.value)}
          className="w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
          placeholder="e.g. Round 4"
          maxLength={80}
        />
      </div>

      {/* Round number (read-only) */}
      <div className="flex items-center gap-3 rounded-xl bg-ps-chip px-4 py-3">
        <span className="text-sm text-ps-text-sec">Round number</span>
        <span className="ml-auto font-mono text-sm font-bold text-ps-text">
          {nextRoundNumber}
        </span>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-ps-border bg-ps-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-ps-text">
          Review summary
        </h3>
        <dl className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <dt className="text-ps-text-sec">Fixtures</dt>
            <dd className="font-semibold text-ps-text">{totalFixtures}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 text-sm">
            <dt className="shrink-0 text-ps-text-sec">Prediction types</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {Array.from(allPredictionTypes).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-ps-amber-soft px-2 py-px text-xs text-ps-amber-deep"
                >
                  {PREDICTION_TYPE_LABELS[t as PredictionTypeName] ?? t}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-ps-text-sec">Total possible points</dt>
            <dd className="font-mono font-bold text-ps-text">
              {totalPossiblePoints}
            </dd>
          </div>
        </dl>
      </div>

      {/* Fixture list preview */}
      <div className="rounded-2xl border border-ps-border bg-ps-surface">
        <div className="border-b border-ps-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-ps-text-ter">
            Fixtures in this round
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto ps-scroll divide-y divide-ps-border">
          {fixtureConfigs.map((fc) => (
            <div
              key={fc.fixture.externalId}
              className="flex items-start gap-3 px-4 py-3"
            >
              <span aria-hidden="true" className="mt-0.5 shrink-0">
                {sportEmoji(fc.fixture.sport)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ps-text">
                  {fc.fixture.homeTeam && fc.fixture.awayTeam
                    ? `${fc.fixture.homeTeam} vs ${fc.fixture.awayTeam}`
                    : fc.fixture.name}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <span className="text-xs text-ps-text-ter">
                    {formatDateTime(fc.fixture.startTime)}
                  </span>
                  {fc.predictionTypes.map((p) => (
                    <span
                      key={p.type}
                      className="rounded-full bg-ps-chip px-1.5 py-px text-[10px] text-ps-text-ter"
                    >
                      {PREDICTION_TYPE_LABELS[p.type]} {p.points}pts
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-ps-red-soft px-4 py-3 text-sm text-ps-red"
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-xl border border-ps-border px-4 py-2 text-sm text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting || !roundName.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-2 text-sm font-semibold text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitting && <SpinnerIcon className="h-4 w-4 animate-spin" />}
          {submitting ? "Creating..." : "Create Round"}
        </button>
      </div>
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function RoundBuilder({
  competitionId,
  nextRoundNumber,
  scoringRules,
  onSuccess,
  onCancel,
}: RoundBuilderProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedFixtures, setSelectedFixtures] = useState<SearchResult[]>([]);
  const [fixtureConfigs, setFixtureConfigs] = useState<FixtureConfig[]>([]);

  function handleFixturesNext() {
    // Build fixture configs from selected fixtures, applying scoring defaults
    const defaults = buildDefaultPredictionTypes(scoringRules);
    const configs: FixtureConfig[] = selectedFixtures.map((f) => ({
      fixture: f,
      predictionTypes: defaults,
      useCustom: false,
    }));
    setFixtureConfigs(configs);
    setStep(1);
  }

  function handleConfigNext() {
    setStep(2);
  }

  return (
    <section
      className="space-y-5 rounded-2xl border border-ps-border bg-ps-bg p-4 sm:p-6"
      aria-label="New round wizard"
    >
      {/* Step indicator */}
      <div className="flex items-center justify-between gap-2">
        <StepIndicator current={step} />
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-ps-text-ter transition-colors hover:bg-ps-chip hover:text-ps-text"
          aria-label="Close round builder"
        >
          Cancel
        </button>
      </div>

      {/* Step content */}
      {step === 0 && (
        <Step1FindFixtures
          selected={selectedFixtures}
          onSelectionChange={setSelectedFixtures}
          onNext={handleFixturesNext}
          onCancel={onCancel}
        />
      )}
      {step === 1 && (
        <Step2Configure
          fixtureConfigs={fixtureConfigs}
          onConfigChange={setFixtureConfigs}
          scoringRules={scoringRules}
          onBack={() => setStep(0)}
          onNext={handleConfigNext}
        />
      )}
      {step === 2 && (
        <Step3Review
          competitionId={competitionId}
          nextRoundNumber={nextRoundNumber}
          fixtureConfigs={fixtureConfigs}
          scoringRules={scoringRules}
          onBack={() => setStep(1)}
          onSuccess={onSuccess}
        />
      )}
    </section>
  );
}
