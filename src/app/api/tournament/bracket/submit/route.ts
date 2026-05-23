import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateWC2026Bracket } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { fanoutBracketToPredictions } from "@/lib/tournament/bracket/predictions-adapter";
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
    action, // 'save_draft' | 'submit'
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

  // Validate bracket on submit (not on draft save)
  if (action === "submit") {
    const validation = validateWC2026Bracket(bracketData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid bracket", errors: validation.errors, warnings: validation.warnings },
        { status: 422 }
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
        bracket_data: bracketData,
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
        bracket_data: bracketData,
        submitted_at: action === "submit" ? now : null,
      })
      .select("id, version_number, status, submitted_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    savedSubmission = created;
  }

  // Fan out group-stage W/D/L picks + tiebreaker scores into `predictions` rows
  // so the Overall/Format classifications can score this user's group matches.
  // Failure here doesn't roll back the bracket save — bracket_data is the
  // source of truth and we can re-run this projection any time.
  const fanout = await fanoutBracketToPredictions(supabase, {
    userId: user.id,
    competitionId,
    bracketData,
  });

  return NextResponse.json(
    {
      submission: savedSubmission,
      fanout: {
        predictions_written: fanout.predictionsWritten,
        errors: fanout.errors,
      },
    },
    { status: existing ? 200 : 201 },
  );
}
