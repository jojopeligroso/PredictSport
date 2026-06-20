/**
 * "X Reckons" copy engine — generates natural-language commentary from
 * prediction + confidence data for chat system messages.
 *
 * FOUNDATION: This module is designed to grow. The template arrays below are
 * starter data that will move to admin-editable competition config. The
 * confidence scale, template variants, tag weaving, and sport-specific
 * overrides are all designed to be driven by data, not code.
 *
 * Future expansion points:
 *  - Templates stored per-competition in DB (admin UI editable)
 *  - Sport-specific template overrides (GAA, F1, golf have different language)
 *  - Locale-aware templates via i18n keys instead of inline strings
 *  - "Report" mode: round summaries, performance narratives, post-match copy
 *  - Tag-aware sentence construction (proper noun vs descriptive tags)
 *  - Crowd sentiment aggregation ("The group is split on this one...")
 */

// ── Types ──────────────────────────────────────────────────────────────

/** A single confidence level with its label and copy templates. */
export interface ConfidenceLevel {
  /** Numeric value stored in the DB. */
  value: number;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Short label for compact UI (pills, badges). */
  shortLabel: string;
}

/** Template set for a specific confidence level. */
export interface CopyTemplateSet {
  /** Confidence value this set applies to. */
  confidence: number;
  /** Standard templates — one is picked per message for variety. */
  win: string[];
  /** Templates for draw predictions. */
  draw: string[];
  /** Templates when the user has a reputation tag (proper noun form). */
  taggedWin: string[];
  /** Tagged draw templates. */
  taggedDraw: string[];
}

/** Context needed to generate a reckons message. */
export interface ReckonsCopyContext {
  name: string;
  team: string;
  score?: string;
  tag?: string;
  confidence: number;
  isDraw?: boolean;
}

/** Category of report message — extensible for future narrative types. */
export type ReportCategory =
  | "reckons"          // prediction + confidence commentary
  | "tag_reveal"       // reputation tag announcement
  | "tag_change"       // tag shift between rounds
  | "round_summary"    // end-of-round performance narrative
  | "streak"           // winning/losing streak callout
  | "milestone";       // points/accuracy milestone

/** A generated report message ready for chat insertion. */
export interface ReportMessage {
  category: ReportCategory;
  text: string;
  /** Confidence value (for border intensity in chat UI). */
  confidence?: number;
  /** Metadata for rendering (tag name, stats, etc). */
  meta?: Record<string, unknown>;
}

// ── Default confidence scale ───────────────────────────────────────────
// Foundation: 5 levels. The system supports arbitrary scales — admin config
// will define per-competition levels with custom labels and template sets.

export const DEFAULT_CONFIDENCE_LEVELS: ConfidenceLevel[] = [
  { value: 1, label: "Hopeful", shortLabel: "Hopeful" },
  { value: 2, label: "Leaning", shortLabel: "Leaning" },
  { value: 3, label: "Confident", shortLabel: "Confident" },
  { value: 4, label: "Very Sure", shortLabel: "V. Sure" },
  { value: 5, label: "Dead Cert", shortLabel: "Dead Cert" },
];

// ── Default templates ──────────────────────────────────────────────────
// Multiple variants per level for variety. Variable syntax: {name}, {team},
// {score}, {tag}. Empty {score} is stripped with trailing whitespace.

export const DEFAULT_TEMPLATES: CopyTemplateSet[] = [
  {
    confidence: 1,
    win: [
      "{name} has a feeling {team} might just nick it. {score}",
      "{name} wouldn't rule out {team} here. {score}",
      "{name} thinks {team} could pull something off... maybe. {score}",
      "A quiet word from {name}: don't sleep on {team}. {score}",
    ],
    draw: [
      "{name} has a feeling this one ends level. {score}",
      "{name} wouldn't be shocked if nobody wins this. {score}",
    ],
    taggedWin: [
      "{tag} {name} has a feeling {team} might just nick it. {score}",
      "A quiet word from {tag} {name}: don't sleep on {team}. {score}",
    ],
    taggedDraw: [
      "{tag} {name} has a feeling this one ends level. {score}",
    ],
  },
  {
    confidence: 2,
    win: [
      "{name} is leaning towards {team}. {score}",
      "{name} fancies {team} in this one. {score}",
      "{name} likes the look of {team}. {score}",
      "Slight nod from {name} towards {team}. {score}",
    ],
    draw: [
      "{name} is leaning towards a stalemate. {score}",
      "{name} thinks this one's tight — draw territory. {score}",
    ],
    taggedWin: [
      "{tag} {name} is leaning towards {team}. {score}",
      "{tag} {name} fancies {team} in this one. {score}",
    ],
    taggedDraw: [
      "{tag} {name} is leaning towards a stalemate. {score}",
    ],
  },
  {
    confidence: 3,
    win: [
      "{name} reckons {team}. {score} Fairly sure about this one.",
      "{name} is backing {team} with conviction. {score}",
      "{name} sees {team} getting the job done. {score}",
      "The call from {name}: {team}. {score} No hesitation.",
    ],
    draw: [
      "{name} reckons neither side has the edge. {score}",
      "{name} is calling the draw here. {score} Confident.",
    ],
    taggedWin: [
      "{tag} {name} reckons {team}. {score} Fairly sure about this one.",
      "The call from {tag} {name}: {team}. {score}",
    ],
    taggedDraw: [
      "{tag} {name} reckons neither side has the edge. {score}",
    ],
  },
  {
    confidence: 4,
    win: [
      "{name} firmly believes {team} will do the business. {score}",
      "{name} is all in on {team}. {score} Very confident.",
      "{name} says {team}, and means it. {score}",
      "Strong conviction from {name}: {team} get it done. {score}",
    ],
    draw: [
      "{name} firmly believes this one's ending all square. {score}",
      "{name} is very sure: draw. {score}",
    ],
    taggedWin: [
      "{tag} {name} firmly believes {team} will do the business. {score}",
      "{tag} {name} is all in on {team}. {score}",
    ],
    taggedDraw: [
      "{tag} {name} firmly believes this one's ending all square. {score}",
    ],
  },
  {
    confidence: 5,
    win: [
      "{name} declares {team} {score} a dead cert. Mark it down.",
      "{name} says {team} {score} is nailed on. Don't even argue.",
      "Absolute certainty from {name}: {team}. {score} This is happening.",
      "{name} has never been more sure of anything. {team}. {score}",
    ],
    draw: [
      "{name} declares the draw {score} a dead cert. Mark it down.",
      "Absolute certainty from {name}: nobody's winning this. {score}",
    ],
    taggedWin: [
      "{tag} {name} declares {team} {score} a dead cert. Mark it down.",
      "Absolute certainty from {tag} {name}: {team}. {score}",
    ],
    taggedDraw: [
      "{tag} {name} declares the draw {score} a dead cert. Mark it down.",
    ],
  },
];

// ── Copy generation ────────────────────────────────────────────────────

/**
 * Generate a "reckons" message from a prediction + confidence context.
 *
 * Returns null if the confidence level has no templates (e.g. an admin-defined
 * level that hasn't had copy written yet).
 */
export function generateReckonsCopy(
  context: ReckonsCopyContext,
  templates: CopyTemplateSet[] = DEFAULT_TEMPLATES,
): ReportMessage | null {
  const level = templates.find((t) => t.confidence === context.confidence);
  if (!level) return null;

  // Select the right template pool
  const hasTag = !!context.tag;
  let pool: string[];
  if (context.isDraw) {
    pool = hasTag && level.taggedDraw.length ? level.taggedDraw : level.draw;
  } else {
    pool = hasTag && level.taggedWin.length ? level.taggedWin : level.win;
  }

  if (pool.length === 0) return null;

  // Stable variant per user (same name → same template for a given event)
  const variant = stableHash(context.name) % pool.length;
  const text = interpolate(pool[variant], context);

  return {
    category: "reckons",
    text,
    confidence: context.confidence,
    meta: {
      name: context.name,
      team: context.team,
      tag: context.tag,
    },
  };
}

// ── Report message stubs ───────────────────────────────────────────────
// Future report categories. These are type-safe stubs so the chat rendering
// layer can switch on `category` now and handle new types as they ship.

export function generateTagRevealCopy(
  _tagName: string,
  _displayName: string,
  _dataFact: string,
): ReportMessage {
  // Stub — will be implemented when tag reveal ships
  return {
    category: "tag_reveal",
    text: "",
    meta: { tagName: _tagName, displayName: _displayName, dataFact: _dataFact },
  };
}

export function generateTagChangeCopy(
  _displayName: string,
  _oldTag: string,
  _newTag: string,
  _reason: string,
): ReportMessage {
  // Stub — will be implemented when tag lifecycle ships
  return {
    category: "tag_change",
    text: "",
    meta: {
      displayName: _displayName,
      oldTag: _oldTag,
      newTag: _newTag,
      reason: _reason,
    },
  };
}

export function generateRoundSummaryCopy(
  _roundNumber: number,
  _topPredictorName: string,
  _stats: Record<string, unknown>,
): ReportMessage {
  // Stub — will be implemented for end-of-round narratives
  return {
    category: "round_summary",
    text: "",
    meta: { roundNumber: _roundNumber, topPredictor: _topPredictorName, ..._stats },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Simple string hash for stable variant selection. */
function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Replace template variables and clean up empty placeholders. */
function interpolate(template: string, ctx: ReckonsCopyContext): string {
  return template
    .replace(/\{name\}/g, ctx.name)
    .replace(/\{team\}/g, ctx.team)
    .replace(/\{score\}/g, ctx.score ?? "")
    .replace(/\{tag\}/g, ctx.tag ?? "")
    .replace(/\s{2,}/g, " ") // collapse double spaces from empty vars
    .trim();
}

/**
 * Format a score pair for use in copy templates.
 * Returns e.g. "2–1" or "" if no score provided.
 */
export function formatScoreForCopy(
  home?: number | null,
  away?: number | null,
): string {
  if (home == null || away == null) return "";
  return `${home}–${away}`;
}

/**
 * Resolve the label for a confidence level.
 * Falls back to "Level {n}" for admin-defined levels without labels.
 */
export function confidenceLabel(
  value: number,
  levels: ConfidenceLevel[] = DEFAULT_CONFIDENCE_LEVELS,
): string {
  return levels.find((l) => l.value === value)?.label ?? `Level ${value}`;
}
