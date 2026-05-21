import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Classification } from "@/types/tournament";
import { getEliminationCurve, previewEliminationConsequences } from "@/lib/tournament/format/elimination";
import { computeGroupComposition } from "@/lib/tournament/format/group-allocation";

/**
 * GET /api/tournament/consequence-table?competitionId=X
 * Returns the resolved elimination curve, group allocation,
 * qualification rules, and finalist count for pre-launch display.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json(
      { error: "competitionId query parameter is required" },
      { status: 400 }
    );
  }

  // Verify membership
  const { data: member } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not a member of this competition" }, { status: 403 });
  }

  // Fetch the format_elimination classification
  const { data: cls, error: clsError } = await supabase
    .from("classifications")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("classification_type", "format_elimination")
    .maybeSingle();

  if (clsError) {
    return NextResponse.json({ error: clsError.message }, { status: 500 });
  }

  if (!cls) {
    return NextResponse.json(
      { error: "No format_elimination classification found for this competition" },
      { status: 404 }
    );
  }

  const classification = cls as Classification;

  // Read curve from classification config
  let curveSteps;
  try {
    curveSteps = getEliminationCurve(classification);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }

  // Build consequence table
  const consequenceTable = previewEliminationConsequences(curveSteps);

  // Compute group allocation for the group stage step
  const groupStageStep = curveSteps.find((s) => s.stage === "group_stage");
  const startStep = curveSteps.find((s) => s.stage === "start");
  const finalStep = curveSteps.find((s) => s.stage === "final");

  let groupComposition = null;
  if (startStep && groupStageStep && startStep.remaining >= 3) {
    try {
      groupComposition = computeGroupComposition(
        startStep.remaining,
        groupStageStep.remaining
      );
    } catch {
      // Non-fatal — group composition may not be solvable for some configs
    }
  }

  return NextResponse.json({
    curve: curveSteps,
    consequenceTable,
    groupComposition,
    finalistCount: finalStep?.remaining ?? 1,
    entrantCount: startStep?.remaining ?? 0,
    qualificationRules: {
      top2AutoQualify: true,
      thirdFrom5PlayerAutoQualifies: true,
      thirdFrom4PlayerBestThird: true,
      thirdFrom3PlayerNeverQualifies: true,
    },
  });
}
