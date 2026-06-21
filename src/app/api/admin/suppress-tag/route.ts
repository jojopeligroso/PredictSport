import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface SuppressTagBody {
  tagId: string;
}

/**
 * POST /api/admin/suppress-tag
 *
 * Suppress a pending reputation tag before it auto-publishes.
 * Only admins/co_admins of the tag's competition can suppress.
 * Only tags with status 'pending' can be suppressed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SuppressTagBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tagId) {
    return NextResponse.json(
      { error: "tagId is required" },
      { status: 400 },
    );
  }

  const serviceClient = createServiceClient();

  // Fetch the tag
  const { data: tag, error: tagError } = await serviceClient
    .from("member_tags")
    .select("id, competition_id, status, tag_name")
    .eq("id", body.tagId)
    .single();

  if (tagError || !tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  // Verify the caller is admin/co_admin of this competition
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", tag.competition_id)
    .eq("user_id", user.id)
    .in("role", ["admin", "co_admin"])
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Only admins can suppress tags" },
      { status: 403 },
    );
  }

  // Only pending tags can be suppressed
  if (tag.status !== "pending") {
    return NextResponse.json(
      {
        error: `Cannot suppress a tag with status '${tag.status}'. Only pending tags can be suppressed.`,
      },
      { status: 400 },
    );
  }

  // Suppress the tag (service-role client for the write)
  const { error: updateError } = await serviceClient
    .from("member_tags")
    .update({
      status: "suppressed",
      suppressed_by: user.id,
      suppressed_at: new Date().toISOString(),
    })
    .eq("id", body.tagId);

  if (updateError) {
    console.error("[suppress-tag] Failed to suppress tag:", updateError);
    return NextResponse.json(
      { error: "Failed to suppress tag" },
      { status: 500 },
    );
  }

  console.log(
    `[suppress-tag] Tag ${tag.tag_name} (${body.tagId}) suppressed by ${user.id}`,
  );

  return NextResponse.json({ success: true });
}
