import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification, ClassificationMembership, StandingRow } from "@/types/tournament";
import { computeOverallStandings, computeFormatStandings, computeBracketStandings } from "./standings-snapshot";

// ============================================================
// Read classifications for a competition
// ============================================================

export async function getClassificationsForCompetition(
  supabase: SupabaseClient,
  competitionId: string
): Promise<Classification[]> {
  const { data, error } = await supabase
    .from("classifications")
    .select("id, competition_id, classification_key, classification_type, name, status, scoring_strategy, elimination_strategy, config, source_template_key, created_at, updated_at")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch classifications: ${error.message}`);
  return data ?? [];
}

// ============================================================
// Get current standings — from latest snapshot or provisional
// ============================================================

export async function getClassificationStandings(
  supabase: SupabaseClient,
  classificationId: string,
  opts?: { provisional?: boolean }
): Promise<StandingRow[]> {
  const provisional = opts?.provisional ?? false;

  if (!provisional) {
    // Return the most recent finalised snapshot
    const { data: snapshot, error } = await supabase
      .from("classification_standings_snapshots")
      .select("standings_data")
      .eq("classification_id", classificationId)
      .not("finalisation_id", "is", null)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch snapshot: ${error.message}`);
    if (snapshot) return snapshot.standings_data as StandingRow[];
  }

  // Provisional: compute live from raw predictions
  const { data: classification, error: clsError } = await supabase
    .from("classifications")
    .select("classification_type, competition_id")
    .eq("id", classificationId)
    .single();

  if (clsError) throw new Error(`Failed to fetch classification: ${clsError.message}`);

  const { data: memberships, error: mbError } = await supabase
    .from("classification_memberships")
    .select("user_id, status")
    .eq("classification_id", classificationId);

  if (mbError) throw new Error(`Failed to fetch memberships: ${mbError.message}`);

  const membershipList = (memberships ?? []) as ClassificationMembership[];

  if (classification.classification_type === "leaderboard") {
    // Overall: fetch all scored predictions scoped to this competition's events
    // For tournament competitions, use tournament_id for shared fixture lookup
    const { data: compMeta } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", classification.competition_id)
      .single();

    const { data: compEvents } = compMeta?.tournament_id
      ? await supabase.from("events").select("id").eq("tournament_id", compMeta.tournament_id)
      : await supabase.from("events").select("id").eq("competition_id", classification.competition_id);
    const compEventIds = (compEvents ?? []).map((e: { id: string }) => e.id);

    const userIds = membershipList.map((m) => m.user_id);
    const { data: predictions, error: predError } = compEventIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id, points_awarded, is_correct, prediction_type, submitted_at, event_id")
          .in("user_id", userIds)
          .in("event_id", compEventIds)
          .order("submitted_at", { ascending: true })
          .limit(10000)
      : { data: [], error: null };

    if (predError) throw new Error(`Failed to fetch predictions: ${predError.message}`);
    return computeOverallStandings(predictions ?? [], membershipList);
  }

  if (classification.classification_type === "format_elimination") {
    // Format: we need a stageId; without one, return latest known snapshot or empty
    const { data: snapshot } = await supabase
      .from("classification_standings_snapshots")
      .select("standings_data")
      .eq("classification_id", classificationId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot) return snapshot.standings_data as StandingRow[];
    return [];
  }

  if (classification.classification_type === "bracket_survivor") {
    const userIds = membershipList.map((m) => m.user_id);
    const { data: submissions, error: subError } = await supabase
      .from("bracket_prediction_submissions")
      .select("user_id, bracket_data")
      .eq("classification_id", classificationId)
      .in("user_id", userIds)
      .in("status", ["submitted", "locked"]);

    if (subError) throw new Error(`Failed to fetch bracket submissions: ${subError.message}`);

    // Template needed for scoring — fetch via classification config
    const { data: clsFull, error: clsFullError } = await supabase
      .from("classifications")
      .select("config")
      .eq("id", classificationId)
      .single();

    if (clsFullError) throw new Error(`Failed to fetch classification config: ${clsFullError.message}`);

    const templateId = (clsFull.config as Record<string, unknown>)?.bracket_template_id as string | undefined;
    if (!templateId) return [];

    const { data: template, error: tplError } = await supabase
      .from("bracket_templates")
      .select("config")
      .eq("id", templateId)
      .maybeSingle();

    if (tplError) throw new Error(`Failed to fetch bracket template: ${tplError.message}`);
    if (!template) return [];

    return computeBracketStandings(submissions ?? [], null, template.config);
  }

  return [];
}

// ============================================================
// Enroll entrant in all active classifications at once
// ============================================================

export async function enrollEntrant(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string
): Promise<ClassificationMembership[]> {
  const classifications = await getClassificationsForCompetition(supabase, competitionId);
  const activeClassifications = classifications.filter((c) => c.status === "active");

  if (activeClassifications.length === 0) return [];

  // Check for existing memberships to avoid duplicate inserts
  const { data: existing } = await supabase
    .from("classification_memberships")
    .select("classification_id")
    .eq("competition_id", competitionId)
    .eq("user_id", userId);

  const alreadyEnrolled = new Set((existing ?? []).map((m: { classification_id: string }) => m.classification_id));

  const toInsert = activeClassifications
    .filter((c) => !alreadyEnrolled.has(c.id))
    .map((c) => ({
      classification_id: c.id,
      competition_id: competitionId,
      user_id: userId,
      status: "active" as const,
      entered_at: new Date().toISOString(),
      metadata: {},
    }));

  if (toInsert.length === 0) {
    // All memberships already exist — return them
    const { data: allMemberships, error } = await supabase
      .from("classification_memberships")
      .select("id, classification_id, competition_id, user_id, status, entered_at, eliminated_at, eliminated_window_id, eliminated_stage_id, elimination_reason, metadata, created_at, updated_at")
      .eq("competition_id", competitionId)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to fetch existing memberships: ${error.message}`);
    return (allMemberships ?? []) as ClassificationMembership[];
  }

  const { data, error } = await supabase
    .from("classification_memberships")
    .insert(toInsert)
    .select("id, classification_id, competition_id, user_id, status, entered_at, eliminated_at, eliminated_window_id, eliminated_stage_id, elimination_reason, metadata, created_at, updated_at");

  if (error) throw new Error(`Failed to enroll entrant: ${error.message}`);
  return (data ?? []) as ClassificationMembership[];
}

// ============================================================
// Withdraw from a specific classification
// ============================================================

export async function withdrawEntrant(
  supabase: SupabaseClient,
  classificationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("classification_memberships")
    .update({
      status: "withdrawn",
      updated_at: new Date().toISOString(),
    })
    .eq("classification_id", classificationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to withdraw entrant: ${error.message}`);
}
