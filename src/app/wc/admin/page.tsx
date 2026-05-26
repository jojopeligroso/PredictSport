import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResultConfirmation } from "@/components/tournament/admin/ResultConfirmation";
import { FinalisationPanel } from "@/components/tournament/admin/FinalisationPanel";
import { CorrectionFlow } from "@/components/tournament/admin/CorrectionFlow";

export const dynamic = "force-dynamic";

/**
 * /admin — Super Admin panel for tournament management.
 * Only visible to super admins.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/admin");
  }

  // Check super admin
  const { data: profile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">Access Denied</h1>
        <p className="mt-2 text-sm text-ps-text-sec">Super admin access required.</p>
      </div>
    );
  }

  // Find WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, status")
    .eq("product_mode", "world_cup_2026_shell")
    .limit(1)
    .maybeSingle();

  // Get prediction windows with event counts
  const { data: windows } = competition
    ? await supabase
        .from("rounds")
        .select("id, name, status, round_number")
        .eq("competition_id", competition.id)
        .order("round_number", { ascending: true })
    : { data: [] };

  // Get event counts per window
  const windowData = await Promise.all(
    (windows ?? []).map(async (w: { id: string; name: string; status: string; round_number: number }) => {
      const { data: events } = await supabase
        .from("events")
        .select("id, event_name, start_time, status, result_data, result_confirmed, round_id, sport, external_event_id")
        .eq("round_id", w.id)
        .order("start_time", { ascending: true });

      const totalEvents = events?.length ?? 0;
      const confirmedEvents = events?.filter((e: { result_confirmed: boolean }) => e.result_confirmed).length ?? 0;

      return {
        ...w,
        totalEvents,
        confirmedEvents,
        events: events ?? [],
      };
    })
  );

  // Get stages with window progress
  const { data: stages } = await supabase
    .from("sporting_stages")
    .select("id, name, status, stage_order")
    .eq("tournament_id", "a0000000-0000-0000-0000-000000000026")
    .order("stage_order", { ascending: true });

  const stageData = (stages ?? []).map((s: { id: string; name: string; status: string; stage_order: number }) => {
    const stageWindows = windowData.filter((w) => {
      // Match windows to stages by round_number ranges
      // GM1=1, GM2=2, GM3=3, R32=4, R16=5, QF=6, SF=7, 3rd=8, Final=9
      return w.round_number === s.stage_order;
    });
    const totalWindows = stageWindows.length;
    const scoredWindows = stageWindows.filter((w) => w.status === "scored").length;

    return { ...s, totalWindows, scoredWindows };
  });

  // Count members
  const { count: memberCount } = competition
    ? await supabase
        .from("competition_members")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competition.id)
    : { count: 0 };

  // Get finalisations for correction flow
  const { data: finalisations } = competition
    ? await supabase
        .from("result_finalisations")
        .select("id, prediction_window_id, sporting_stage_id, finalisation_type, status, finalised_at")
        .eq("competition_id", competition.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // All events for corrections
  const allEvents = windowData.flatMap((w) => w.events);

  // Windows that have events worth showing in result confirmation
  // (locked or resulted windows with at least one event)
  const confirmableWindows = windowData.filter(
    (w) => (w.status === "locked" || w.status === "scored") && w.totalEvents > 0
  );

  // Build name maps for CorrectionFlow
  const windowNameMap: Record<string, string> = {};
  for (const w of windowData) {
    windowNameMap[w.id] = w.name;
  }
  const stageNameMap: Record<string, string> = {};
  for (const s of stageData) {
    stageNameMap[s.id] = s.name;
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">Tournament Admin</h1>

      {/* Competition status */}
      <div className="mt-6 rounded-xl border border-ps-border bg-ps-surface p-4">
        <h2 className="text-sm font-bold text-ps-text">
          {competition?.name ?? "No competition"}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold">
            {competition?.status ?? "N/A"}
          </span>
          <span className="font-mono text-xs text-ps-text-ter">
            {memberCount ?? 0} entrants
          </span>
        </div>
      </div>

      {/* Result Confirmation */}
      {confirmableWindows.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ps-text-ter">
            Confirm Results
          </h2>
          <div className="mt-3">
            <ResultConfirmation
              windows={confirmableWindows.map((w) => ({
                id: w.id,
                name: w.name,
                status: w.status,
                events: w.events.map((e: {
                  id: string;
                  event_name: string;
                  start_time: string;
                  status: string;
                  result_data: Record<string, unknown> | null;
                  result_confirmed: boolean;
                  round_id: string | null;
                  sport: string;
                  external_event_id: string | null;
                }) => ({
                  id: e.id,
                  event_name: e.event_name,
                  start_time: e.start_time,
                  status: e.status,
                  result_data: e.result_data,
                  result_confirmed: e.result_confirmed,
                  round_id: e.round_id,
                  sport: e.sport,
                  external_event_id: e.external_event_id,
                })),
              }))}
            />
          </div>
        </div>
      )}

      {/* Finalisation Controls */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ps-text-ter">
          Finalisation
        </h2>
        <div className="mt-3">
          <FinalisationPanel
            windows={windowData.map((w) => ({
              id: w.id,
              name: w.name,
              status: w.status,
              totalEvents: w.totalEvents,
              confirmedEvents: w.confirmedEvents,
            }))}
            stages={stageData.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
              totalWindows: s.totalWindows,
              scoredWindows: s.scoredWindows,
            }))}
          />
        </div>
      </div>

      {/* Corrections (only show if finalisations exist) */}
      {(finalisations ?? []).length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ps-text-ter">
            Result Corrections
          </h2>
          <div className="mt-3">
            <CorrectionFlow
              finalisations={(finalisations ?? []).map((f: {
                id: string;
                prediction_window_id: string | null;
                sporting_stage_id: string | null;
                finalisation_type: string;
                status: string;
                finalised_at: string | null;
              }) => f)}
              events={allEvents.map((e: {
                id: string;
                event_name: string;
                result_data: Record<string, unknown> | null;
                result_confirmed: boolean;
              }) => ({
                id: e.id,
                event_name: e.event_name,
                result_data: e.result_data,
                result_confirmed: e.result_confirmed,
              }))}
              windowNames={windowNameMap}
              stageNames={stageNameMap}
            />
          </div>
        </div>
      )}
    </div>
  );
}
