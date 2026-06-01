import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function requireDisplayName(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from("users")
    .select("display_name, is_super_admin")
    .eq("id", userId)
    .single();

  if (data?.is_super_admin) {
    return null;
  }

  if (!data?.display_name) {
    return NextResponse.json(
      { error: "Please set a display name before continuing" },
      { status: 403 }
    );
  }

  return null;
}
