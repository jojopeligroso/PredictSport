import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";

  // C3: Validate redirect target — must be a relative path, not a protocol-relative
  // URL (//evil.com) or absolute URL (https://evil.com). Prevents open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.display_name && (next === "/" || next === "/wc")) {
          return NextResponse.redirect(`${origin}/wc/home`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth`
  );
}
