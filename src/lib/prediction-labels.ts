import type { PredictionType } from "@/types/database";

/** Sports where "Top N" should default to "Podium Positions" */
const MOTORSPORT = new Set(["formula_1", "horse_racing"]);

/** Sports where position-based prediction language fits better */
const RACE_SPORTS = new Set([
  "formula_1",
  "golf",
  "horse_racing",
  "athletics",
]);

/** Default user-facing labels per prediction type */
const BASE_LABELS: Record<PredictionType, string> = {
  winner: "Winner",
  exact_score: "Correct Score",
  margin: "Winning Margin",
  over_under: "Over/Under",
  handicap: "Spread",
  head_to_head: "H2H",
  yes_no: "Prop Bet",
  top_n: "Top 3",
  progression: "To Qualify",
  final_standings: "Outright Winner",
};

/**
 * Context-aware labels that incorporate config values (line, n, etc.)
 * Used on prediction forms where the specific number matters.
 */
function getContextualLabel(
  type: PredictionType,
  config: Record<string, unknown> | null,
  sport?: string | null,
): string {
  const c = config ?? {};

  switch (type) {
    case "top_n": {
      const n = (c.n as number) ?? 3;
      if (sport && MOTORSPORT.has(sport)) return `Podium Positions (Top ${n})`;
      return `Top ${n}`;
    }
    case "final_standings": {
      const positions = (c.positions as number) ?? (c.n as number) ?? 5;
      return `Predict the Top ${positions}`;
    }
    case "over_under": {
      const line = c.line as number | undefined;
      return line != null ? `Over/Under ${line}` : "Over/Under";
    }
    case "handicap": {
      const line = c.line as number | undefined;
      const team = c.team as string | undefined;
      if (line != null && team) return `${team} ${line > 0 ? "+" : ""}${line}`;
      if (line != null) return `Spread ${line > 0 ? "+" : ""}${line}`;
      return "Spread";
    }
    default:
      return getLabel(type, config, sport);
  }
}

/**
 * Get the display label for a prediction type.
 *
 * Priority:
 *   1. `config.display_label` — admin-customised name
 *   2. Sport-aware default (e.g. motorsport top_n → "Podium Positions")
 *   3. Base label from the global map
 */
export function getLabel(
  type: PredictionType,
  config?: Record<string, unknown> | null,
  sport?: string | null,
): string {
  // Admin override
  const displayLabel = (config ?? {}).display_label as string | undefined;
  if (displayLabel) return displayLabel;

  // Sport-aware defaults
  if (type === "top_n" && sport && MOTORSPORT.has(sport)) {
    const n = ((config ?? {}).n as number) ?? 3;
    return `Podium Positions (Top ${n})`;
  }

  return BASE_LABELS[type];
}

/**
 * Get the full contextual label for prediction forms.
 * Includes dynamic values like the over/under line or handicap spread.
 *
 * Priority:
 *   1. `config.display_label` — admin-customised name
 *   2. Contextual label with config values
 */
export function getFormLabel(
  type: PredictionType,
  config?: Record<string, unknown> | null,
  sport?: string | null,
): string {
  const displayLabel = ((config ?? {}).display_label as string) ?? null;
  if (displayLabel) return displayLabel;
  return getContextualLabel(type, config ?? null, sport);
}

/** Short pill label for compact UI (admin selectors, tag lists) */
export function getPillLabel(
  type: PredictionType,
  config?: Record<string, unknown> | null,
  sport?: string | null,
): string {
  return getLabel(type, config, sport);
}

/** Description text for admin forms explaining what each type does */
const TYPE_DESCRIPTIONS: Record<PredictionType, string> = {
  winner: "Pick the outright winner",
  exact_score: "Predict the exact final score",
  margin: "Predict the winning margin range",
  over_under: "Predict above or below a line",
  handicap: "Predict whether a team covers the spread",
  head_to_head: "Pick which of two finishes higher",
  yes_no: "Binary outcome (Yes/No)",
  top_n: "Pick someone to finish in the top positions",
  progression: "Predict how far a team/player advances",
  final_standings: "Rank competitors in predicted finishing order",
};

export function getDescription(type: PredictionType): string {
  return TYPE_DESCRIPTIONS[type];
}

/** Whether this prediction type supports admin label/config adjustment */
const ADJUSTABLE_TYPES = new Set<PredictionType>([
  "top_n",
  "final_standings",
  "handicap",
  "over_under",
  "progression",
  "yes_no",
]);

export function isAdjustable(type: PredictionType): boolean {
  return ADJUSTABLE_TYPES.has(type);
}

/** Fields an admin can tweak per adjustable type */
export interface AdjustableField {
  key: string;
  label: string;
  type: "text" | "number" | "string_list";
  defaultValue: unknown;
}

export function getAdjustableFields(type: PredictionType): AdjustableField[] {
  const fields: AdjustableField[] = [
    { key: "display_label", label: "Custom label", type: "text", defaultValue: "" },
  ];

  switch (type) {
    case "top_n":
      fields.push({ key: "n", label: "Top N", type: "number", defaultValue: 3 });
      break;
    case "final_standings":
      fields.push({ key: "positions", label: "Positions", type: "number", defaultValue: 5 });
      break;
    case "handicap":
      fields.push({ key: "line", label: "Line", type: "number", defaultValue: -1.5 });
      break;
    case "over_under":
      fields.push({ key: "line", label: "Line", type: "number", defaultValue: 2.5 });
      break;
    case "progression":
      fields.push({ key: "stages", label: "Stages", type: "string_list", defaultValue: [] });
      break;
    case "yes_no":
      fields.push({ key: "options", label: "Options", type: "string_list", defaultValue: ["Yes", "No"] });
      break;
  }

  return fields;
}

/** All prediction types available for admin selection (excludes exact_score which auto-pairs with winner) */
export const SELECTABLE_TYPES: PredictionType[] = [
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

/** Whether a sport uses position-based results (no home/away) */
export function isRaceSport(sport: string): boolean {
  return RACE_SPORTS.has(sport);
}
