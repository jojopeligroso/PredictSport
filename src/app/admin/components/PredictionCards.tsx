"use client";

/**
 * PredictionCards - Card-based UI components for Round Builder Step 2
 *
 * Replaces checkbox grid with progressive disclosure cards:
 * - PrimaryOutcomeCard: Required (HOME/DRAW/AWAY or Winner)
 * - ScoringPredictionsCard: Optional (Margin, O/U, Handicap)
 * - TopNCard: Optional (Top N, Final Standings, Progression)
 * - YesNoCard: Optional (Custom yes/no questions)
 */

import { useState } from "react";
import { allowsDraws } from "@/lib/draw-eligibility";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrimaryOutcome {
  type: "head_to_head" | "winner";
  points: number;
  partialPoints?: number;
  config?: {
    options?: string[];
    allow_draw?: boolean;
    draw_points?: number;
  };
}

export interface ScoringPrediction {
  enabled: boolean;
  points: number;
  partialPoints?: number;
  config?: {
    threshold?: number; // for margin
    line?: number; // for over_under
    value?: number; // for handicap
  };
}

export interface ScoringPredictions {
  margin?: ScoringPrediction;
  over_under?: ScoringPrediction;
  handicap?: ScoringPrediction;
}

export interface TopNPredictions {
  top_n?: ScoringPrediction & { config?: { n?: number } };
  final_standings?: ScoringPrediction;
  progression?: ScoringPrediction;
}

export interface YesNoPrediction {
  enabled: boolean;
  points: number;
  partialPoints?: number;
  question?: string;
}

export interface CardBasedPredictionState {
  primaryOutcome: PrimaryOutcome;
  scoringPredictions?: ScoringPredictions;
  topNPredictions?: TopNPredictions;
  yesNo?: YesNoPrediction;
}

interface Fixture {
  homeTeam?: string;
  awayTeam?: string;
  sport: string;
  name: string;
  providerLeague?: string;
}

// allowsDraws imported from @/lib/draw-eligibility

// ── State Transformation ──────────────────────────────────────────────────────

export interface PredictionTypeConfig {
  type: string;
  points: number;
  partial_points?: number;
  config?: Record<string, unknown>;
}

/**
 * Transform card-based state to API-compatible prediction type configs
 */
export function cardsToConfigs(
  cards: CardBasedPredictionState
): PredictionTypeConfig[] {
  const configs: PredictionTypeConfig[] = [];

  // Primary outcome (required)
  configs.push({
    type: cards.primaryOutcome.type,
    points: cards.primaryOutcome.points,
    partial_points: cards.primaryOutcome.partialPoints,
    config: cards.primaryOutcome.config,
  });

  // Scoring predictions (optional)
  if (cards.scoringPredictions) {
    const { margin, over_under, handicap } = cards.scoringPredictions;

    if (margin?.enabled) {
      configs.push({
        type: "margin",
        points: margin.points,
        partial_points: margin.partialPoints,
        config: margin.config,
      });
    }

    if (over_under?.enabled) {
      configs.push({
        type: "over_under",
        points: over_under.points,
        partial_points: over_under.partialPoints,
        config: over_under.config,
      });
    }

    if (handicap?.enabled) {
      configs.push({
        type: "handicap",
        points: handicap.points,
        partial_points: handicap.partialPoints,
        config: handicap.config,
      });
    }
  }

  // Top N predictions (optional)
  if (cards.topNPredictions) {
    const { top_n, final_standings, progression } = cards.topNPredictions;

    if (top_n?.enabled) {
      configs.push({
        type: "top_n",
        points: top_n.points,
        partial_points: top_n.partialPoints,
        config: top_n.config,
      });
    }

    if (final_standings?.enabled) {
      configs.push({
        type: "final_standings",
        points: final_standings.points,
        partial_points: final_standings.partialPoints,
        config: final_standings.config,
      });
    }

    if (progression?.enabled) {
      configs.push({
        type: "progression",
        points: progression.points,
        partial_points: progression.partialPoints,
        config: progression.config,
      });
    }
  }

  // Yes/No (optional)
  if (cards.yesNo?.enabled) {
    configs.push({
      type: "yes_no",
      points: cards.yesNo.points,
      partial_points: cards.yesNo.partialPoints,
      config: { question: cards.yesNo.question },
    });
  }

  return configs;
}

/**
 * Transform API configs to card-based state (for editing existing rounds)
 */
export function configsToCards(
  configs: PredictionTypeConfig[],
  fixture: Fixture
): CardBasedPredictionState {
  const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);

  // Find primary outcome
  const primaryType = isTwoTeam ? "head_to_head" : "winner";
  const primaryConfig = configs.find((c) => c.type === primaryType);

  // Auto-generate config from fixture data if missing (safety net for paths
  // that rebuild prediction types without preserving config)
  const primaryOutcomeConfig: PrimaryOutcome["config"] =
    (primaryConfig?.config as PrimaryOutcome["config"]) ??
    (isTwoTeam
      ? {
          options: [fixture.homeTeam || "Home", fixture.awayTeam || "Away"],
          allow_draw: allowsDraws(fixture.sport, fixture.providerLeague),
          draw_points: primaryConfig?.points || 10,
        }
      : undefined);

  const state: CardBasedPredictionState = {
    primaryOutcome: {
      type: primaryType,
      points: primaryConfig?.points || 10,
      partialPoints: primaryConfig?.partial_points,
      config: primaryOutcomeConfig,
    },
  };

  // Scoring predictions (2-team only)
  if (isTwoTeam) {
    state.scoringPredictions = {
      margin: transformScoringPrediction(configs, "margin"),
      over_under: transformScoringPrediction(configs, "over_under"),
      handicap: transformScoringPrediction(configs, "handicap"),
    };
  } else {
    // Top N predictions (multi-competitor only)
    state.topNPredictions = {
      top_n: transformScoringPrediction(configs, "top_n") as TopNPredictions["top_n"],
      final_standings: transformScoringPrediction(configs, "final_standings"),
      progression: transformScoringPrediction(configs, "progression"),
    };
  }

  // Yes/No (available for all)
  const yesNoConfig = configs.find((c) => c.type === "yes_no");
  if (yesNoConfig) {
    state.yesNo = {
      enabled: true,
      points: yesNoConfig.points,
      partialPoints: yesNoConfig.partial_points,
      question: (yesNoConfig.config?.question as string) || "",
    };
  } else {
    state.yesNo = {
      enabled: false,
      points: 5,
    };
  }

  return state;
}

function transformScoringPrediction(
  configs: PredictionTypeConfig[],
  type: string
): ScoringPrediction | undefined {
  const config = configs.find((c) => c.type === type);
  if (config) {
    return {
      enabled: true,
      points: config.points,
      partialPoints: config.partial_points,
      config: config.config as ScoringPrediction["config"],
    };
  }
  return undefined;
}

// ── Card Container ────────────────────────────────────────────────────────────

interface CardContainerProps {
  title: string;
  description?: string;
  required?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function CardContainer({
  title,
  description,
  required = false,
  collapsible = false,
  defaultExpanded = true,
  children,
}: CardContainerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl border border-ps-border bg-ps-surface">
      <div
        className={`flex items-center justify-between p-4 ${
          collapsible ? "cursor-pointer" : ""
        }`}
        onClick={collapsible ? () => setExpanded(!expanded) : undefined}
      >
        <div>
          <h3 className="text-sm font-semibold text-ps-text">
            {title}
            {required && <span className="ml-1 text-ps-red">*</span>}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-ps-text-sec">{description}</p>
          )}
        </div>
        {collapsible && (
          <svg
            className={`h-5 w-5 text-ps-text-sec transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
      {expanded && <div className="border-t border-ps-border p-4">{children}</div>}
    </div>
  );
}

// ── Primary Outcome Card ──────────────────────────────────────────────────────

interface PrimaryOutcomeCardProps {
  fixture: Fixture;
  value: PrimaryOutcome;
  onChange: (value: PrimaryOutcome) => void;
  defaultPoints: number;
}

export function PrimaryOutcomeCard({
  fixture,
  value,
  onChange,
  defaultPoints,
}: PrimaryOutcomeCardProps) {
  const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);
  const showDraw = isTwoTeam && allowsDraws(fixture.sport, fixture.providerLeague);

  const handlePointsChange = (points: number) => {
    onChange({ ...value, points });
  };

  return (
    <CardContainer
      title={isTwoTeam ? "Match Result" : "Winner Prediction"}
      description={
        isTwoTeam
          ? "Pick who wins or if it's a draw"
          : "Predict the winner of this event"
      }
      required
      collapsible={false}
    >
      <div className="space-y-4">
        {/* Team/Winner display - PREVIEW ONLY */}
        {isTwoTeam ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-ps-text-sec">
              Prediction options (preview)
            </p>
            <p className="text-[10px] uppercase tracking-wider text-ps-text-ter">
              {fixture.homeTeam} vs {fixture.awayTeam}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 rounded-xl border border-ps-border bg-ps-chip px-4 py-2.5 text-center text-sm font-medium text-ps-text-sec opacity-60">
                {fixture.homeTeam || "Home"}
              </div>
              {showDraw && (
                <div className="flex-1 rounded-xl border border-ps-border bg-ps-chip px-4 py-2.5 text-center text-sm font-medium text-ps-text-sec opacity-60">
                  Draw
                </div>
              )}
              <div className="flex-1 rounded-xl border border-ps-border bg-ps-chip px-4 py-2.5 text-center text-sm font-medium text-ps-text-sec opacity-60">
                {fixture.awayTeam || "Away"}
              </div>
            </div>
            <p className="text-[10px] text-ps-text-ter">
              ↑ Preview of options participants will see
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-ps-text-sec">
              Prediction options (preview)
            </p>
            <p className="text-xs text-ps-text-ter">
              Participants will select their predicted winner from the field
            </p>
          </div>
        )}

        {/* Points configuration */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ps-text">
            Points for correct prediction
          </label>
          <input
            type="number"
            min={1}
            value={value.points || defaultPoints}
            onChange={(e) => handlePointsChange(Number(e.target.value))}
            className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
            placeholder={`Default: ${defaultPoints}`}
          />
        </div>

        {/* Info text */}
        <p className="text-xs text-ps-text-ter">
          {isTwoTeam
            ? `${showDraw ? "Three-way" : "Two-way"} match result prediction. ${showDraw ? "Draw option available for " + fixture.sport + "." : ""}`
            : "Winner prediction for multi-competitor event"}
        </p>
      </div>
    </CardContainer>
  );
}

// ── Scoring Predictions Card ──────────────────────────────────────────────────

interface ScoringPredictionsCardProps {
  value: ScoringPredictions;
  onChange: (value: ScoringPredictions) => void;
  defaultPoints: {
    margin: number;
    over_under: number;
    handicap: number;
  };
}

export function ScoringPredictionsCard({
  value,
  onChange,
  defaultPoints,
}: ScoringPredictionsCardProps) {
  const handleToggle = (type: keyof ScoringPredictions) => {
    const current = value[type];
    onChange({
      ...value,
      [type]: current?.enabled
        ? { ...current, enabled: false }
        : { enabled: true, points: defaultPoints[type], config: {} },
    });
  };

  const handlePointsChange = (
    type: keyof ScoringPredictions,
    points: number
  ) => {
    const current = value[type];
    if (current) {
      onChange({
        ...value,
        [type]: { ...current, points },
      });
    }
  };

  const handleConfigChange = (
    type: keyof ScoringPredictions,
    configKey: string,
    configValue: number
  ) => {
    const current = value[type];
    if (current) {
      onChange({
        ...value,
        [type]: {
          ...current,
          config: { ...current.config, [configKey]: configValue },
        },
      });
    }
  };

  return (
    <CardContainer
      title="Advanced Scoring Predictions"
      description="Add margin, over/under, or handicap predictions (optional)"
      collapsible
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Margin */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.margin?.enabled || false}
              onChange={() => handleToggle("margin")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">
              Margin Prediction
            </span>
          </label>
          {value.margin?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.margin.points}
                    onChange={(e) =>
                      handlePointsChange("margin", Number(e.target.value))
                    }
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Threshold (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.margin.config?.threshold || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "margin",
                        "threshold",
                        Number(e.target.value)
                      )
                    }
                    placeholder="e.g., 7"
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-ps-text-ter">
                Predict winning margin within threshold
              </p>
            </div>
          )}
        </div>

        {/* Over/Under */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.over_under?.enabled || false}
              onChange={() => handleToggle("over_under")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">
              Over/Under
            </span>
          </label>
          {value.over_under?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.over_under.points}
                    onChange={(e) =>
                      handlePointsChange("over_under", Number(e.target.value))
                    }
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Line
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={value.over_under.config?.line || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "over_under",
                        "line",
                        Number(e.target.value)
                      )
                    }
                    placeholder="e.g., 45.5"
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-ps-text-ter">
                Total points over or under the line
              </p>
            </div>
          )}
        </div>

        {/* Handicap */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.handicap?.enabled || false}
              onChange={() => handleToggle("handicap")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">Handicap</span>
          </label>
          {value.handicap?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.handicap.points}
                    onChange={(e) =>
                      handlePointsChange("handicap", Number(e.target.value))
                    }
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Handicap Value
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={value.handicap.config?.value || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "handicap",
                        "value",
                        Number(e.target.value)
                      )
                    }
                    placeholder="e.g., -7.5"
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-ps-text-ter">
                Winner after applying handicap
              </p>
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
}

// ── Top N Predictions Card ────────────────────────────────────────────────────

interface TopNPredictionsCardProps {
  value: TopNPredictions;
  onChange: (value: TopNPredictions) => void;
  defaultPoints: {
    top_n: number;
    final_standings: number;
    progression: number;
  };
}

export function TopNPredictionsCard({
  value,
  onChange,
  defaultPoints,
}: TopNPredictionsCardProps) {
  const handleToggle = (type: keyof TopNPredictions) => {
    const current = value[type];
    onChange({
      ...value,
      [type]: current?.enabled
        ? { ...current, enabled: false }
        : { enabled: true, points: defaultPoints[type], config: {} },
    });
  };

  const handlePointsChange = (type: keyof TopNPredictions, points: number) => {
    const current = value[type];
    if (current) {
      onChange({
        ...value,
        [type]: { ...current, points },
      });
    }
  };

  const handleNChange = (n: number) => {
    if (value.top_n) {
      onChange({
        ...value,
        top_n: {
          ...value.top_n,
          config: { ...value.top_n.config, n },
        },
      });
    }
  };

  return (
    <CardContainer
      title="Advanced Tournament Predictions"
      description="Add top N, final standings, or progression predictions (optional)"
      collapsible
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Top N */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.top_n?.enabled || false}
              onChange={() => handleToggle("top_n")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">
              Top N Prediction
            </span>
          </label>
          {value.top_n?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.top_n.points}
                    onChange={(e) =>
                      handlePointsChange("top_n", Number(e.target.value))
                    }
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-ps-text-sec">
                    Top N (e.g., 3)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={value.top_n.config?.n || 3}
                    onChange={(e) => handleNChange(Number(e.target.value))}
                    className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-ps-text-ter">
                Predict who finishes in the top N positions
              </p>
            </div>
          )}
        </div>

        {/* Final Standings */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.final_standings?.enabled || false}
              onChange={() => handleToggle("final_standings")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">
              Final Standings
            </span>
          </label>
          {value.final_standings?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div>
                <label className="block text-xs text-ps-text-sec">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  value={value.final_standings.points}
                  onChange={(e) =>
                    handlePointsChange("final_standings", Number(e.target.value))
                  }
                  className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                />
              </div>
              <p className="text-xs text-ps-text-ter">
                Predict exact finishing order
              </p>
            </div>
          )}
        </div>

        {/* Progression */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.progression?.enabled || false}
              onChange={() => handleToggle("progression")}
              className="h-4 w-4 rounded accent-ps-amber"
            />
            <span className="text-sm font-medium text-ps-text">
              Progression
            </span>
          </label>
          {value.progression?.enabled && (
            <div className="ml-6 space-y-2 rounded-lg border border-ps-border bg-ps-bg p-3">
              <div>
                <label className="block text-xs text-ps-text-sec">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  value={value.progression.points}
                  onChange={(e) =>
                    handlePointsChange("progression", Number(e.target.value))
                  }
                  className="w-full rounded border border-ps-border bg-ps-surface px-2 py-1 text-sm"
                />
              </div>
              <p className="text-xs text-ps-text-ter">
                Predict who advances to next round
              </p>
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
}

// ── Yes/No Card ───────────────────────────────────────────────────────────────

interface YesNoCardProps {
  value: YesNoPrediction;
  onChange: (value: YesNoPrediction) => void;
  defaultPoints: number;
}

export function YesNoCard({
  value,
  onChange,
  defaultPoints,
}: YesNoCardProps) {
  const handleToggle = () => {
    onChange({
      ...value,
      enabled: !value.enabled,
      points: value.points || defaultPoints,
    });
  };

  const handlePointsChange = (points: number) => {
    onChange({ ...value, points });
  };

  const handleQuestionChange = (question: string) => {
    onChange({ ...value, question });
  };

  return (
    <CardContainer
      title="Custom Yes/No Question"
      description="Add a custom yes/no prediction (optional)"
      collapsible
      defaultExpanded={false}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={handleToggle}
            className="h-4 w-4 rounded accent-ps-amber"
          />
          <span className="text-sm font-medium text-ps-text">
            Enable Yes/No question
          </span>
        </label>

        {value.enabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ps-text-sec">
                Question
              </label>
              <input
                type="text"
                value={value.question || ""}
                onChange={(e) => handleQuestionChange(e.target.value)}
                placeholder="e.g., Will there be a red card?"
                className={`w-full rounded-lg border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:outline-none ${
                  !value.question
                    ? "border-ps-amber focus:border-ps-amber-deep"
                    : "border-ps-border focus:border-ps-amber"
                }`}
              />
              {!value.question && (
                <p className="mt-1 text-xs text-ps-amber-deep">
                  Question text is required
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-ps-text-sec">
                Points for correct answer
              </label>
              <input
                type="number"
                min={1}
                value={value.points}
                onChange={(e) => handlePointsChange(Number(e.target.value))}
                className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
              />
            </div>

            <p className="text-xs text-ps-text-ter">
              Participants answer YES or NO to your custom question
            </p>
          </div>
        )}
      </div>
    </CardContainer>
  );
}

// ── Combined Card View ────────────────────────────────────────────────────────

interface CardBasedConfigProps {
  fixture: Fixture;
  initialConfigs?: PredictionTypeConfig[];
  defaultPoints: {
    head_to_head: number;
    winner: number;
    margin: number;
    over_under: number;
    handicap: number;
    top_n: number;
    final_standings: number;
    progression: number;
    yes_no: number;
  };
  onChange: (configs: PredictionTypeConfig[]) => void;
}

/**
 * Card-based prediction configuration UI
 * Manages all cards and state transformation
 */
export function CardBasedConfig({
  fixture,
  initialConfigs = [],
  defaultPoints,
  onChange,
}: CardBasedConfigProps) {
  const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);

  // Initialize card state from configs
  const [cardState, setCardState] = useState<CardBasedPredictionState>(() => {
    if (initialConfigs.length > 0) {
      return configsToCards(initialConfigs, fixture);
    }

    // Default state: only primary outcome enabled
    const primaryType = isTwoTeam ? "head_to_head" : "winner";
    return {
      primaryOutcome: {
        type: primaryType,
        points: isTwoTeam ? defaultPoints.head_to_head : defaultPoints.winner,
        config: isTwoTeam
          ? {
              options: [fixture.homeTeam || "Home", fixture.awayTeam || "Away"],
              allow_draw: allowsDraws(fixture.sport, fixture.providerLeague),
              draw_points: defaultPoints.head_to_head,
            }
          : undefined,
      },
      scoringPredictions: isTwoTeam
        ? {
            margin: undefined,
            over_under: undefined,
            handicap: undefined,
          }
        : undefined,
      topNPredictions: !isTwoTeam
        ? {
            top_n: undefined,
            final_standings: undefined,
            progression: undefined,
          }
        : undefined,
      yesNo: {
        enabled: false,
        points: defaultPoints.yes_no,
      },
    };
  });

  // Update parent whenever card state changes
  const handleCardStateChange = (newState: CardBasedPredictionState) => {
    setCardState(newState);
    onChange(cardsToConfigs(newState));
  };

  return (
    <div className="space-y-4">
      {/* Primary Outcome (required) */}
      <PrimaryOutcomeCard
        fixture={fixture}
        value={cardState.primaryOutcome}
        onChange={(primaryOutcome) =>
          handleCardStateChange({ ...cardState, primaryOutcome })
        }
        defaultPoints={
          isTwoTeam ? defaultPoints.head_to_head : defaultPoints.winner
        }
      />

      {/* Scoring Predictions (2-team only) */}
      {isTwoTeam && cardState.scoringPredictions && (
        <ScoringPredictionsCard
          value={cardState.scoringPredictions}
          onChange={(scoringPredictions) =>
            handleCardStateChange({ ...cardState, scoringPredictions })
          }
          defaultPoints={{
            margin: defaultPoints.margin,
            over_under: defaultPoints.over_under,
            handicap: defaultPoints.handicap,
          }}
        />
      )}

      {/* Top N Predictions (multi-competitor only) */}
      {!isTwoTeam && cardState.topNPredictions && (
        <TopNPredictionsCard
          value={cardState.topNPredictions}
          onChange={(topNPredictions) =>
            handleCardStateChange({ ...cardState, topNPredictions })
          }
          defaultPoints={{
            top_n: defaultPoints.top_n,
            final_standings: defaultPoints.final_standings,
            progression: defaultPoints.progression,
          }}
        />
      )}

      {/* Yes/No (all fixture types) */}
      {cardState.yesNo && (
        <YesNoCard
          value={cardState.yesNo}
          onChange={(yesNo) => handleCardStateChange({ ...cardState, yesNo })}
          defaultPoints={defaultPoints.yes_no}
        />
      )}
    </div>
  );
}
