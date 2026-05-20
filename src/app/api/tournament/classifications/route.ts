import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tournament/classifications?competitionId=xxx
 * List all classifications for a competition.
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

  // RLS ensures only competition members can see these
  const { data, error } = await supabase
    .from("classifications")
    .select("*")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classifications: data });
}
