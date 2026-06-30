import { createServiceClient } from "@/lib/supabase/service";
import { applyVisibility } from "@/lib/tournament/visibility";
import { ShowcaseClient } from "./ShowcaseClient";

export const dynamic = "force-dynamic";

/**
 * /wc/showcase — public, no-auth showcase page.
 *
 * All display names are anonymised via viewerRole 'public'.
 * Uses service client to bypass RLS (no user session exists).
 */
export default async function ShowcasePage() {
  const supabase = createServiceClient();

  // Find the active WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, tournament_id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-12 text-center">
        <p className="text-sm text-ps-text-sec">No active competition.</p>
      </div>
    );
  }

  // Get classifications
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id, name, classification_key, classification_type, status")
    .eq("competition_id", competition.id)
    .in("classification_key", ["overall", "format"]);

  const overallCls = (classifications ?? []).find(
    (c: { classification_key: string }) => c.classification_key === "overall"
  );
  const formatCls = (classifications ?? []).find(
    (c: { classification_key: string }) => c.classification_key === "format"
  );

  // Member count
  const { count: memberCount } = await supabase
    .from("competition_members")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competition.id);

  // Confirmed events count
  const { count: confirmedEvents } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", competition.tournament_id)
    .eq("result_confirmed", true);

  // Overall standings (anonymised)
  let overallStandings: Array<{
    rank: number;
    user_id: string;
    display_name: string;
    points: number;
  }> = [];

  if (overallCls) {
    const { data: memberships } = await supabase
      .from("classification_memberships")
      .select("user_id, status, display_visibility, pseudonym")
      .eq("classification_id", overallCls.id);

    const userIds = (memberships ?? []).map(
      (m: { user_id: string }) => m.user_id
    );

    if (userIds.length > 0) {
      const [{ data: pointRows }, { data: users }] = await Promise.all([
        supabase.rpc("sum_prediction_points", {
          p_user_ids: userIds,
          p_tournament_id: competition.tournament_id,
          p_competition_id: competition.id,
        }),
        supabase.from("users").select("id, display_name").in("id", userIds),
      ]);

      const pointsMap = new Map<string, number>();
      for (const uid of userIds) pointsMap.set(uid, 0);
      for (const r of (pointRows ?? []) as Array<{
        user_id: string;
        total_points: number;
      }>) {
        pointsMap.set(r.user_id, r.total_points ?? 0);
      }

      const nameMap = new Map(
        (users ?? []).map((u: { id: string; display_name: string }) => [
          u.id,
          u.display_name,
        ])
      );

      const rawStandings = [...pointsMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([userId, points], idx) => ({
          rank: idx + 1,
          user_id: userId,
          display_name: nameMap.get(userId) || "Unknown",
          points,
        }));

      // Anonymise ALL names for public view
      const visibility = (memberships ?? []).map(
        (m: {
          user_id: string;
          display_visibility: "public" | "private";
          pseudonym: string | null;
        }) => ({
          user_id: m.user_id,
          display_visibility: m.display_visibility,
          pseudonym: m.pseudonym,
        })
      );

      overallStandings = applyVisibility(
        rawStandings,
        visibility,
        overallCls.classification_type,
        "", // no viewer
        "public"
      );
    }
  }

  // Format groups (anonymised)
  let formatGroups: Array<{
    group_name: string;
    members: Array<{ display_name: string; points: number }>;
  }> = [];

  if (formatCls) {
    // Get active groups (current stage)
    const { data: groups } = await supabase
      .from("format_prediction_groups")
      .select("id, group_name, group_number, status")
      .eq("classification_id", formatCls.id)
      .eq("status", "active")
      .order("group_number", { ascending: true });

    if (groups && groups.length > 0) {
      // Get all memberships for these groups
      const groupIds = groups.map((g: { id: string }) => g.id);
      const { data: groupMembers } = await supabase
        .from("format_group_memberships")
        .select("group_id, user_id")
        .in("group_id", groupIds);

      const memberUserIds = [
        ...new Set(
          (groupMembers ?? []).map((m: { user_id: string }) => m.user_id)
        ),
      ];

      // Get display names and pseudonyms
      const [{ data: memberUsers }, { data: memberVis }] = await Promise.all([
        supabase
          .from("users")
          .select("id, display_name")
          .in("id", memberUserIds),
        supabase
          .from("classification_memberships")
          .select("user_id, pseudonym")
          .eq("classification_id", formatCls.id)
          .in("user_id", memberUserIds),
      ]);

      const nameMap = new Map(
        (memberUsers ?? []).map((u: { id: string; display_name: string }) => [
          u.id,
          u.display_name,
        ])
      );
      const pseudonymMap = new Map(
        (memberVis ?? []).map(
          (v: { user_id: string; pseudonym: string | null }) => [
            v.user_id,
            v.pseudonym,
          ]
        )
      );

      // Get points for format stage
      const { data: stagePoints } = await supabase.rpc(
        "sum_prediction_points",
        {
          p_user_ids: memberUserIds,
          p_tournament_id: competition.tournament_id,
          p_competition_id: competition.id,
        }
      );
      const pointsMap = new Map(
        ((stagePoints ?? []) as Array<{
          user_id: string;
          total_points: number;
        }>).map((r) => [r.user_id, r.total_points ?? 0])
      );

      for (const group of groups as Array<{
        id: string;
        group_name: string;
      }>) {
        const members = (groupMembers ?? [])
          .filter((m: { group_id: string }) => m.group_id === group.id)
          .map((m: { user_id: string }) => {
            // Public view: always use pseudonym
            const pseudonym =
              pseudonymMap.get(m.user_id) ?? "Mystery Player";
            return {
              display_name: pseudonym,
              points: pointsMap.get(m.user_id) ?? 0,
            };
          })
          .sort(
            (
              a: { points: number },
              b: { points: number }
            ) => b.points - a.points
          );

        formatGroups.push({ group_name: group.group_name, members });
      }
    }
  }

  return (
    <ShowcaseClient
      competitionName={competition.name ?? "World Cup 2026"}
      memberCount={memberCount ?? 0}
      confirmedEvents={confirmedEvents ?? 0}
      overallStandings={overallStandings}
      formatGroups={formatGroups}
    />
  );
}
