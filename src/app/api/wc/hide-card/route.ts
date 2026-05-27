import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";

/**
 * GET /api/wc/hide-card
 *
 * MANUAL TRIGGER ONLY (not scheduled). Sets hidden_at on all WC
 * tournament competitions so the promo card disappears from the
 * dashboard once the tournament concludes. WC pages remain accessible
 * via direct URL.
 *
 * Trigger manually around Aug/Sep 2026, e.g.:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://predictsport-rust.vercel.app/api/wc/hide-card
 * Or wire up a one-shot pg_cron job closer to the date.
 *
 * SECURITY: Protected by CRON_SECRET (Vault secret `cron_secret`).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("competitions")
    .update({ hidden_at: new Date().toISOString() })
    .eq("tournament_id", WC2026_TOURNAMENT_ID)
    .is("hidden_at", null)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: "Failed to hide WC competitions", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    hidden: data?.length ?? 0,
    hidden_at: new Date().toISOString(),
  });
}
