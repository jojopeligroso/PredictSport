import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getWindowsToLock,
  lockPredictionWindow,
  getClassificationsNeedingReconciliation,
} from "@/lib/tournament/prediction-window";
import { reconcileUndersizedGroups } from "@/lib/tournament/format/group-allocation";

export const dynamic = "force-dynamic";

/**
 * GET /api/tournament/cron/lock-windows
 *
 * Scheduled EVERY 5 MIN by Supabase pg_cron (job `wc-lock-windows`,
 * see migration 20260528000100). For each tournament competition
 * (tournament_id IS NOT NULL, status active or draft), finds open rounds
 * whose earliest event lock_time <= now and sets them to 'locked'.
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
  // Verify cron secret -- Vercel sends this automatically for cron jobs
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Find tournament competitions (active or draft)
  const { data: competitions, error: compError } = await supabase
    .from("competitions")
    .select("id, name")
    .not("tournament_id", "is", null)
    .in("status", ["active", "draft"]);

  if (compError) {
    console.error("lock-windows cron: failed to fetch competitions:", compError.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  const locked: string[] = [];
  const reconciled: string[] = [];
  const errors: string[] = [];

  for (const comp of competitions ?? []) {
    // Reconcile undersized groups when first event locks
    try {
      const needsReconciliation = await getClassificationsNeedingReconciliation(
        supabase, comp.id,
      );
      for (const cls of needsReconciliation) {
        try {
          const result = await reconcileUndersizedGroups(supabase, cls.classificationId);

          // Stamp groups_reconciled_at so we don't re-check
          const { data: clsRow } = await supabase
            .from("classifications")
            .select("config")
            .eq("id", cls.classificationId)
            .single();

          const config = ((clsRow?.config ?? {}) as Record<string, unknown>);
          config.groups_reconciled_at = new Date().toISOString();

          await supabase
            .from("classifications")
            .update({ config })
            .eq("id", cls.classificationId);

          if (result && result.movedMembers > 0) {
            reconciled.push(
              `${comp.name}: dissolved ${result.dissolved.join(", ")} → ${result.modified.join(", ")}`,
            );
          } else {
            reconciled.push(`${comp.name}: all groups viable, stamped`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`lock-windows cron: group reconciliation failed: ${msg}`);
          errors.push(`${comp.name} (reconcile)`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`lock-windows cron: reconciliation check failed for ${comp.name}: ${msg}`);
    }

    try {
      const windowsToLock = await getWindowsToLock(supabase, comp.id);

      for (const w of windowsToLock) {
        try {
          await lockPredictionWindow(supabase, w.id);
          locked.push(`${comp.name} / ${w.name}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`lock-windows cron: failed to lock ${w.name}: ${msg}`);
          errors.push(`${comp.name} / ${w.name}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`lock-windows cron: failed checking ${comp.name}: ${msg}`);
      errors.push(comp.name);
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    competitions_checked: (competitions ?? []).length,
    locked,
    reconciled: reconciled.length > 0 ? reconciled : undefined,
    errors: errors.length > 0 ? errors : undefined,
  });
}
