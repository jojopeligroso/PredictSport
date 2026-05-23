import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateWC2026Bracket,
  WC2026_GROUPS,
} from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { loadGroupDataFromPredictions } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";
import type { BracketSubmissionData } from "@/types/tournament";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    classificationId,
    competitionId,
    bracketData,
    action,
  } = body as {
    classificationId: string;
    competitionId: string;
    bracketData: BracketSubmissionData;
    action: "save_draft" | "submit";
  };

  if (!classificationId || !competitionId || !bracketData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check user is a member of this competition
  const { data: member } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member of this competition" }, { status: 403 });
  }

  // Check classification exists and is active
  const { data: classification } = await supabase
    .from("classifications")
    .select("id, status")
    .eq("id", classificationId)
    .single();

  if (!classification || classification.status !== "active") {
    return NextResponse.json({ error: "Classification not active" }, { status: 400 });
  }

  // Validate bracket on submit (not on draft save).
  //
  // groupRankings is *never stored* — under the 2026-05-23 unified-predictions
  // amendment, group W/D/L lives in `predictions` rows. We compute the
  // rankings here from those rows so the validator can apply WC2026
  // group-count / id checks without depending on client-supplied data.
  let groupRankingsForValidation: Record<string, string[]> = {};
  if (action === "submit") {
    const groups = await loadGroupDataFromPredictions(supabase, {
      userId: user.id,
      competitionId,
      groups: WC2026_GROUPS,
    });
    groupRankingsForValidation = groupDataToRankings(groups);

    const validation = validateWC2026Bracket({
      ...bracketData,
      groupRankings: groupRankingsForValidation,
    });
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid bracket", errors: validation.errors, warnings: validation.warnings },
        { status: 422 },
      );
    }
  }

  // Get bracket template
  const { data: template } = await supabase
    .from("bracket_templates")
    .select("id")
    .eq("template_key", "fifa_world_cup_2026")
    .single();

  if (!template) {
    return NextResponse.json({ error: "Bracket template not found" }, { status: 500 });
  }

  // Strip any legacy fields the client may still send. Storage shape is now:
  //   { bestThirdPicks, knockoutPicks, champion, thirdPlace? }
  const persistedData: BracketSubmissionData = {
    bestThirdPicks: bracketData.bestThirdPicks ?? [],
    knockoutPicks: bracketData.knockoutPicks ?? {},
    champion: bracketData.champion ?? "",
    thirdPlace: bracketData.thirdPlace,
  };

  // Check for existing submission (non-superseded)
  const { data: existing } = await supabase
    .from("bracket_prediction_submissions")
    .select("id, version_number, status")
    .eq("classification_id", classificationId)
    .eq("user_id", user.id)
    .neq("status", "superseded")
    .maybeSingle();

  // Can't modify locked submissions
  if (existing?.status === "locked") {
    return NextResponse.json({ error: "Bracket is locked and cannot be modified" }, { status: 400 });
  }

  const status = action === "submit" ? "submitted" : "draft";
  const now = new Date().toISOString();

  let savedSubmission;

  if (existing) {
    const { data: updated, error } = await supabase
      .from("bracket_prediction_submissions")
      .update({
        bracket_data: persistedData,
        status,
        version_number: existing.version_number + 1,
        submitted_at: action === "submit" ? now : null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id, version_number, status, submitted_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    savedSubmission = updated;
  } else {
    const { data: created, error } = await supabase
      .from("bracket_prediction_submissions")
      .insert({
        competition_id: competitionId,
        classification_id: classificationId,
        bracket_template_id: template.id,
        user_id: user.id,
        version_number: 1,
        status,
        bracket_data: persistedData,
        submitted_at: action === "submit" ? now : null,
      })
      .select("id, version_number, status, submitted_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    savedSubmission = created;
  }

  // R32 Pick is an automatic byproduct of the Full Bracket — opt the user into
  // the R32 Pick classification membership the moment they submit a bracket
  // for the full_bracket classification. Idempotent: existing memberships are
  // left untouched.
  if (action === "submit") {
    const { data: r32Cls } = await supabase
      .from("classifications")
      .select("id")
      .eq("competition_id", competitionId)
      .eq("classification_key", "r32_pick")
      .eq("status", "active")
      .maybeSingle();
    if (r32Cls) {
      await supabase
        .from("classification_memberships")
        .upsert(
          {
            classification_id: r32Cls.id,
            competition_id: competitionId,
            user_id: user.id,
            status: "active",
          },
          { onConflict: "classification_id,user_id" },
        );
    }
  }

  return NextResponse.json(
    { submission: savedSubmission },
    { status: existing ? 200 : 201 },
  );
}
