import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WcAdminClient } from "./WcAdminClient";
import { ResultConfirmation } from "@/components/tournament/admin/ResultConfirmation";
import { FinalisationPanel } from "@/components/tournament/admin/FinalisationPanel";
import { CorrectionFlow } from "@/components/tournament/admin/CorrectionFlow";

export const dynamic = "force-dynamic";

/**
 * /wc/admin — Tournament admin panel.
 * Access: competition admin/co_admin of the WC competition,
 * or super admin (if no competition exists yet, for creation).
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/admin");
  }

  // Find WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, status, invite_code, created_by, visibility")
    .eq("product_mode", "world_cup_2026_shell")
    .limit(1)
    .maybeSingle();

  // Auth: if competition exists, check membership. If not, allow super admin to create.
  if (competition) {
    const { data: membership } = await supabase
      .from("competition_members")
      .select("role")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .in("role", ["admin", "co_admin"])
      .maybeSingle();

    if (!membership) {
      return (
        <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
          <h1 className="text-xl font-bold text-ps-text">Access Denied</h1>
          <p className="mt-2 text-sm text-ps-text-sec">
            You are not an admin of this competition.
          </p>
        </div>
      );
    }
  } else {
    // No competition — only super admin can create
    const { data: profile } = await supabase
      .from("users")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      return (
        <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
          <h1 className="text-xl font-bold text-ps-text">Access Denied</h1>
          <p className="mt-2 text-sm text-ps-text-sec">
            No World Cup competition exists yet.
          </p>
        </div>
      );
    }
  }

  // --- No competition: render creation form ---
  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
        <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-ps-text">
          Match Day Desk
        </h1>
        <WcAdminClient mode="create" />
      </div>
    );
  }

  // --- Competition exists: fetch all data for dashboard ---
  const [
    { data: members },
    { data: classifications },
    { data: inviteTokens },
    { data: pw1 },
  ] = await Promise.all([
    supabase
      .from("competition_members")
      .select("id, user_id, role, callout_label, joined_at, user:users(display_name, email)")
      .eq("competition_id", competition.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("classifications")
      .select("id, classification_key, name, status, classification_type")
      .eq("competition_id", competition.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invite_tokens")
      .select("id, token, expires_at, max_uses, use_count, created_at")
      .eq("competition_id", competition.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rounds")
      .select("id, status, lock_time")
      .eq("competition_id", competition.id)
      .eq("round_number", 1)
      .maybeSingle(),
  ]);

  const pw1Locked =
    pw1?.status === "locked" ||
    pw1?.status === "scored" ||
    (pw1?.lock_time != null && new Date(pw1.lock_time) < new Date());

  // Operations data (windows, stages, finalisations) — for collapsible section
  const { data: windows } = await supabase
    .from("rounds")
    .select("id, name, status, round_number")
    .eq("competition_id", competition.id)
    .order("round_number", { ascending: true });

  const windowData = await Promise.all(
    (windows ?? []).map(async (w) => {
      const { data: events } = await supabase
        .from("events")
        .select("id, event_name, start_time, status, result_data, result_confirmed, round_id, sport, external_event_id")
        .eq("round_id", w.id)
        .order("start_time", { ascending: true });

      return {
        ...w,
        totalEvents: events?.length ?? 0,
        confirmedEvents: events?.filter((e: { result_confirmed: boolean }) => e.result_confirmed).length ?? 0,
        events: events ?? [],
      };
    })
  );

  const { data: stages } = await supabase
    .from("sporting_stages")
    .select("id, name, status, stage_order")
    .eq("tournament_id", "a0000000-0000-0000-0000-000000000026")
    .order("stage_order", { ascending: true });

  const stageData = (stages ?? []).map((s) => {
    const stageWindows = windowData.filter((w) => w.round_number === s.stage_order);
    return {
      ...s,
      totalWindows: stageWindows.length,
      scoredWindows: stageWindows.filter((w) => w.status === "scored").length,
    };
  });

  const { data: finalisations } = await supabase
    .from("result_finalisations")
    .select("id, prediction_window_id, sporting_stage_id, finalisation_type, status, finalised_at")
    .eq("competition_id", competition.id)
    .order("created_at", { ascending: false });

  const confirmableWindows = windowData.filter(
    (w) => (w.status === "locked" || w.status === "scored") && w.totalEvents > 0
  );

  const windowNameMap: Record<string, string> = {};
  for (const w of windowData) windowNameMap[w.id] = w.name;
  const stageNameMap: Record<string, string> = {};
  for (const s of stageData) stageNameMap[s.id] = s.name;

  const allEvents = windowData.flatMap((w) => w.events);
  const hasOperationsContent =
    confirmableWindows.length > 0 ||
    windowData.length > 0 ||
    (finalisations ?? []).length > 0;

  // Flatten members for client
  const flatMembers = (members ?? []).map((m) => {
    // Supabase join may return object or array depending on relationship inference
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role as "admin" | "co_admin" | "mod" | "participant",
      joined_at: m.joined_at,
      display_name: u?.display_name || "Unknown",
      email: u?.email ?? "",
    };
  });

  const flatClassifications = (classifications ?? []).map((c) => ({
    id: c.id,
    key: c.classification_key,
    name: c.name,
    status: c.status,
    type: c.classification_type,
  }));

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">
        Match Day Desk
      </h1>

      <WcAdminClient
        mode="dashboard"
        competition={{
          id: competition.id,
          name: competition.name,
          status: competition.status,
          invite_code: competition.invite_code,
          created_by: competition.created_by,
        }}
        members={flatMembers}
        classifications={flatClassifications}
        inviteTokens={(inviteTokens ?? []).map((t) => ({
          id: t.id,
          token: t.token,
          expires_at: t.expires_at,
          max_uses: t.max_uses,
          use_count: t.use_count,
        }))}
        pw1Locked={pw1Locked}
        currentUserId={user.id}
      />

      {/* Operations section — collapsible */}
      {hasOperationsContent && (
        <details className="mt-8">
          <summary className="cursor-pointer select-none text-sm font-bold uppercase tracking-widest text-ps-text-ter hover:text-ps-text transition-colors">
            Operations
          </summary>

          {confirmableWindows.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
                Confirm Results
              </h3>
              <div className="mt-2">
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

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
              Finalisation
            </h3>
            <div className="mt-2">
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

          {(finalisations ?? []).length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
                Result Corrections
              </h3>
              <div className="mt-2">
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
        </details>
      )}
    </div>
  );
}
