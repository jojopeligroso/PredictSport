import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push/send";

/**
 * GET /api/notifications/missing-results
 *
 * Scheduled DAILY at 10:00 UTC by Supabase pg_cron (job
 * `wc-missing-results-daily`, see migration 20260528000100). Finds events
 * past start_time with no confirmed result and pushes admins to enter
 * results manually (for sports without provider coverage).
 *
 * SECURITY: Protected by CRON_SECRET (Vault secret `cron_secret`).
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Find events past start_time with no confirmed result, across active competitions
  const { data: overdueEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, event_name, sport, start_time, competition_id")
    .lt("start_time", now.toISOString())
    .eq("result_confirmed", false)
    .neq("status", "cancelled")
    .is("result_data", null);

  if (eventsError) {
    console.error("[MISSING-RESULTS CRON]", eventsError.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  if (!overdueEvents || overdueEvents.length === 0) {
    return NextResponse.json({ ok: true, overdue: 0, notified: 0 });
  }

  // Group by competition
  const byComp = new Map<string, typeof overdueEvents>();
  for (const e of overdueEvents) {
    const list = byComp.get(e.competition_id) ?? [];
    list.push(e);
    byComp.set(e.competition_id, list);
  }

  // Get competition names
  const compIds = Array.from(byComp.keys());
  const { data: comps } = await supabase
    .from("competitions")
    .select("id, name, status")
    .in("id", compIds)
    .eq("status", "active");

  const activeCompIds = new Set((comps ?? []).map((c) => c.id));
  const compNameMap = new Map((comps ?? []).map((c) => [c.id, c.name]));

  // Get admin/co_admin members for active competitions
  const { data: adminMembers } = activeCompIds.size > 0
    ? await supabase
        .from("competition_members")
        .select("competition_id, user_id")
        .in("competition_id", Array.from(activeCompIds))
        .in("role", ["admin", "co_admin"])
    : { data: [] };

  // Build per-user notification: aggregate all their admin competitions' overdue counts
  const userNotifs = new Map<string, { competitions: { name: string; count: number }[] }>();
  for (const m of adminMembers ?? []) {
    if (!activeCompIds.has(m.competition_id)) continue;
    const events = byComp.get(m.competition_id);
    if (!events || events.length === 0) continue;

    const existing = userNotifs.get(m.user_id) ?? { competitions: [] };
    existing.competitions.push({
      name: compNameMap.get(m.competition_id) ?? "Competition",
      count: events.length,
    });
    userNotifs.set(m.user_id, existing);
  }

  let notified = 0;
  for (const [userId, data] of userNotifs) {
    const totalOverdue = data.competitions.reduce((sum, c) => sum + c.count, 0);
    const compSummary = data.competitions
      .map((c) => `${c.name} (${c.count})`)
      .join(", ");

    try {
      await sendPushToUser(
        userId,
        {
          title: `${totalOverdue} result${totalOverdue !== 1 ? "s" : ""} needed`,
          body: compSummary,
          url: "/competitions",
          tag: "missing-results",
        },
        "result_notifications",
      );
      notified++;
    } catch (err) {
      console.error(`[MISSING-RESULTS CRON] Push failed for ${userId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    overdue: overdueEvents.length,
    competitions: activeCompIds.size,
    notified,
  });
}
