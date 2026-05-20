import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassificationMembership,
  ClassificationStandingsSnapshot,
  StandingRow,
  GenerationMethod,
  SnapshotType,
  BracketSubmissionData,
  BracketTemplateConfig,
} from "@/types/tournament";
import type { Prediction } from "@/types/database";

// ============================================================
// Snapshot generation options
// ============================================================

export interface GenerateSnapshotOpts {
  snapshotType: SnapshotType;
  predictionWindowId?: string;
  sportingStageId?: string;
  generatedBy?: string;
  generationMethod?: GenerationMethod;
}

// ============================================================
// Write an immutable snapshot after finalisation
// ============================================================

export async function generateStandingsSnapshot(
  supabase: SupabaseClient,
  classificationId: string,
  finalisationId: string,
  opts: GenerateSnapshotOpts
): Promise<ClassificationStandingsSnapshot> {
  const { data: classification, error: clsError } = await supabase
    .from("classifications")
    .select("competition_id, classification_type")
    .eq("id", classificationId)
    .single();

  if (clsError) throw new Error(`Failed to fetch classification: ${clsError.message}`);

  const { data: memberships, error: mbError } = await supabase
    .from("classification_memberships")
    .select("*")
    .eq("classification_id", classificationId);

  if (mbError) throw new Error(`Failed to fetch memberships: ${mbError.message}`);

  const membershipList = (memberships ?? []) as ClassificationMembership[];

  let standingsData: StandingRow[] = [];

  if (classification.classification_type === "leaderboard") {
    // Get all event IDs for this competition to scope predictions correctly
    const { data: compEvents } = await supabase
      .from("events")
      .select("id")
      .eq("competition_id", classification.competition_id);
    const compEventIds = (compEvents ?? []).map((e: { id: string }) => e.id);

    const userIds = membershipList.map((m) => m.user_id);
    const { data: predictions, error: predError } = compEventIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id, points_awarded, is_correct, prediction_type, submitted_at, event_id")
          .in("user_id", userIds)
          .in("event_id", compEventIds)
          .order("submitted_at", { ascending: true })
      : { data: [], error: null };

    if (predError) throw new Error(`Failed to fetch predictions: ${predError.message}`);
    standingsData = computeOverallStandings(predictions ?? [], membershipList);
  } else if (classification.classification_type === "format_elimination") {
    if (!opts.sportingStageId) {
      throw new Error("sportingStageId required for format_elimination snapshot");
    }
    // Get events for this competition scoped to the sporting stage's prediction windows
    const { data: stageRounds } = await supabase
      .from("rounds")
      .select("id")
      .eq("competition_id", classification.competition_id)
      .eq("sporting_stage_id", opts.sportingStageId);
    const roundIds = (stageRounds ?? []).map((r: { id: string }) => r.id);

    const { data: stageEvents } = roundIds.length > 0
      ? await supabase.from("events").select("id").in("round_id", roundIds)
      : { data: [] };
    const stageEventIds = (stageEvents ?? []).map((e: { id: string }) => e.id);

    const userIds = membershipList.map((m) => m.user_id);
    const { data: predictions, error: predError } = stageEventIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id, points_awarded, is_correct, prediction_type, submitted_at, event_id")
          .in("user_id", userIds)
          .in("event_id", stageEventIds)
          .order("submitted_at", { ascending: true })
      : { data: [], error: null };

    if (predError) throw new Error(`Failed to fetch predictions: ${predError.message}`);
    standingsData = computeFormatStandings(predictions ?? [], membershipList, opts.sportingStageId);
  } else if (classification.classification_type === "bracket_survivor") {
    const { data: clsFull } = await supabase
      .from("classifications")
      .select("config")
      .eq("id", classificationId)
      .single();

    const templateId = (clsFull?.config as Record<string, unknown>)?.bracket_template_id as string | undefined;

    const userIds = membershipList.map((m) => m.user_id);
    const { data: submissions } = await supabase
      .from("bracket_prediction_submissions")
      .select("*")
      .eq("classification_id", classificationId)
      .in("user_id", userIds)
      .in("status", ["submitted", "locked"]);

    let templateConfig: BracketTemplateConfig | null = null;
    if (templateId) {
      const { data: template } = await supabase
        .from("bracket_templates")
        .select("config")
        .eq("id", templateId)
        .maybeSingle();
      templateConfig = template?.config ?? null;
    }

    standingsData = computeBracketStandings(submissions ?? [], null, templateConfig);
  }

  const checksum = computeChecksum(classificationId, standingsData);

  const snapshotRow = {
    classification_id: classificationId,
    competition_id: classification.competition_id,
    prediction_window_id: opts.predictionWindowId ?? null,
    sporting_stage_id: opts.sportingStageId ?? null,
    finalisation_id: finalisationId,
    snapshot_type: opts.snapshotType,
    standings_data: standingsData,
    entrant_count: membershipList.length,
    generated_at: new Date().toISOString(),
    generated_by: opts.generatedBy ?? null,
    generation_method: opts.generationMethod ?? "automatic",
    checksum,
  };

  const { data, error } = await supabase
    .from("classification_standings_snapshots")
    .insert(snapshotRow)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to insert standings snapshot: ${error.message}`);
  return data as ClassificationStandingsSnapshot;
}

// ============================================================
// Pure function: compute overall (cumulative) standings
// ============================================================

export function computeOverallStandings(
  predictions: Partial<Prediction>[],
  memberships: ClassificationMembership[]
): StandingRow[] {
  // Aggregate per user
  const userMap = new Map<string, {
    points: number;
    exactHits: number;
    outcomeHits: number;
    earliestSubmission: string | null;
    status: ClassificationMembership["status"];
    eliminated: boolean;
  }>();

  for (const m of memberships) {
    userMap.set(m.user_id, {
      points: 0,
      exactHits: 0,
      outcomeHits: 0,
      earliestSubmission: null,
      status: m.status,
      eliminated: m.status === "eliminated" || m.status === "dead",
    });
  }

  for (const pred of predictions) {
    if (!pred.user_id) continue;
    const entry = userMap.get(pred.user_id);
    if (!entry) continue;

    entry.points += pred.points_awarded ?? 0;

    if (pred.prediction_type === "exact_score" && pred.is_correct === true) {
      entry.exactHits += 1;
    }
    if (
      (pred.prediction_type === "winner" || pred.prediction_type === "head_to_head") &&
      pred.is_correct === true
    ) {
      entry.outcomeHits += 1;
    }

    const submittedAt = pred.submitted_at ?? null;
    if (submittedAt) {
      if (
        entry.earliestSubmission === null ||
        submittedAt < entry.earliestSubmission
      ) {
        entry.earliestSubmission = submittedAt;
      }
    }
  }

  // Build rows and sort
  const rows = Array.from(userMap.entries()).map(([userId, agg]) => ({
    userId,
    points: agg.points,
    exactHits: agg.exactHits,
    outcomeHits: agg.outcomeHits,
    earliestSubmission: agg.earliestSubmission,
    status: agg.status,
    eliminated: agg.eliminated,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
    if (b.outcomeHits !== a.outcomeHits) return b.outcomeHits - a.outcomeHits;
    // Earlier aggregate submission wins (ascending)
    const aTime = a.earliestSubmission ?? "";
    const bTime = b.earliestSubmission ?? "";
    if (aTime !== bTime) return aTime < bTime ? -1 : 1;
    // Seeded random fallback
    return seededRandom(userId_seed(a.userId)) - seededRandom(userId_seed(b.userId));
  });

  return assignRanks(rows.map((r) => ({
    user_id: r.userId,
    points: r.points,
    status: r.status,
    eliminated: r.eliminated,
    tie_break_values: {
      exact_hits: r.exactHits,
      outcome_hits: r.outcomeHits,
    },
    display_name: "",
    movement: null,
    metadata: {},
  })));
}

// ============================================================
// Pure function: compute format standings (stage-local points)
// ============================================================

export function computeFormatStandings(
  predictions: Partial<Prediction>[],
  memberships: ClassificationMembership[],
  stageId: string
): StandingRow[] {
  // For stage-local scoring the caller should pass only predictions for this stage.
  // stageId is used to tag the snapshot; filtering is the caller's responsibility.
  // We apply the same tie-break hierarchy as the spec.
  void stageId;
  return computeOverallStandings(predictions, memberships);
}

// ============================================================
// Pure function: compute bracket survivor standings
// ============================================================

export function computeBracketStandings(
  submissions: BracketPredictionSubmissionInput[],
  officialResults: OfficialBracketResults | null,
  template: BracketTemplateConfig | null
): StandingRow[] {
  // Without official results we can only show submitted/locked brackets with unknown status
  if (!officialResults || !template) {
    return submissions.map((s, idx) => ({
      rank: idx + 1,
      user_id: s.user_id,
      display_name: "",
      points: 0,
      status: "active" as const,
      eliminated: false,
      tie_break_values: {},
      movement: null,
      metadata: { bracket_status: "pending" },
    }));
  }

  // Score each bracket submission
  const scored = submissions.map((submission) => {
    const result = scoreBracketSubmission(submission.bracket_data as BracketSubmissionData, officialResults, template);
    return {
      user_id: submission.user_id,
      points: result.correctPicks,
      alive: result.status === "live",
      deadAtRound: result.deadAtRound,
    };
  });

  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    // Alive before dead
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return 0;
  });

  return assignRanks(scored.map((s) => ({
    user_id: s.user_id,
    display_name: "",
    points: s.points,
    status: s.alive ? ("active" as const) : ("dead" as const),
    eliminated: !s.alive,
    tie_break_values: {},
    movement: null,
    metadata: s.deadAtRound ? { dead_at_round: s.deadAtRound } : {},
  })));
}

// ============================================================
// Internal helpers
// ============================================================

function assignRanks(rows: Omit<StandingRow, "rank">[]): StandingRow[] {
  let rank = 1;
  return rows.map((row, idx) => {
    if (idx > 0) {
      const prev = rows[idx - 1];
      const sameRank =
        prev.points === row.points &&
        JSON.stringify(prev.tie_break_values) === JSON.stringify(row.tie_break_values);
      if (!sameRank) rank = idx + 1;
    }
    return { ...row, rank };
  });
}

function userId_seed(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededRandom(seed: number): number {
  // Simple mulberry32 step
  let s = seed >>> 0;
  s += 0x6d2b79f5;
  s = Math.imul(s ^ (s >>> 15), 1 | s);
  s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
  return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
}

function computeChecksum(classificationId: string, data: StandingRow[]): string {
  const raw = classificationId + JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Minimal bracket scoring inline (avoids circular dependency with bracket engine)
interface BracketPredictionSubmissionInput {
  user_id: string;
  bracket_data: unknown;
}

interface OfficialBracketResults {
  knockoutWinners: Record<string, string>;
  groupRankings: Record<string, string[]>;
}

interface BracketScoringResult {
  status: "live" | "dead";
  correctPicks: number;
  totalResolved: number;
  deadAtRound?: string;
}

function scoreBracketSubmission(
  data: BracketSubmissionData,
  results: OfficialBracketResults,
  _template: BracketTemplateConfig
): BracketScoringResult {
  let correctPicks = 0;
  let totalResolved = 0;
  let dead = false;
  let deadAtRound: string | undefined;

  for (const [slotId, pick] of Object.entries(data.knockoutPicks ?? {})) {
    const official = results.knockoutWinners[slotId];
    if (official === undefined) continue;
    totalResolved++;
    if (pick.winner === official) {
      correctPicks++;
    } else {
      dead = true;
      deadAtRound = deadAtRound ?? slotId;
    }
  }

  return {
    status: dead ? "dead" : "live",
    correctPicks,
    totalResolved,
    deadAtRound,
  };
}
