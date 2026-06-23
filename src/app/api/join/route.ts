import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { requireDisplayName } from "@/lib/require-display-name";
import { sendPushToUser } from "@/lib/push/send";
import {
  joinCompetitionWithCap,
  CompetitionFullError,
} from "@/lib/tournament/cap-aware-join";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in first" },
      { status: 401 }
    );
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  // 2. Parse body
  let body: { token?: string; competitionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
  const { token, competitionId: openJoinCompId } = body;

  // 2b. Open join path — WC shell competitions skip invite code validation
  let competitionId: string;
  let isInviteToken = false;
  let invite: { id: string; competition_id: string; expires_at: string | null; max_uses: number | null; use_count: number } | null = null;

  if (openJoinCompId && !token) {
    // Verify this competition exists and is a WC shell
    const { data: comp } = await supabase
      .from("competitions")
      .select("id, entry_closes_at")
      .eq("id", openJoinCompId)
      .eq("product_mode", "world_cup_2026_shell")
      .in("status", ["draft", "active"])
      .single();

    if (!comp) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    if (comp.entry_closes_at && new Date(comp.entry_closes_at) < new Date()) {
      return NextResponse.json(
        { error: "Joins are closed for this competition" },
        { status: 410 }
      );
    }

    competitionId = comp.id;
  } else {
    // Standard invite code path
    if (!token) {
      return NextResponse.json(
        { error: "Invalid invite link" },
        { status: 404 }
      );
    }

    // 3. Look up invite — try invite_tokens first, then competitions.invite_code
    const trimmedToken = token.trim();

    const { data: inviteRow } = await supabase
      .from("invite_tokens")
      .select("*")
      .eq("token", trimmedToken)
      .single();

    if (inviteRow) {
      // Found in invite_tokens — validate expiry and max uses
      isInviteToken = true;
      invite = inviteRow;
      competitionId = inviteRow.competition_id;

      if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
        return NextResponse.json(
          { error: "This invite link has expired" },
          { status: 410 }
        );
      }

      if (inviteRow.max_uses !== null && inviteRow.use_count >= inviteRow.max_uses) {
        return NextResponse.json(
          { error: "This invite link has reached its maximum uses" },
          { status: 410 }
        );
      }
    } else {
      // Not in invite_tokens — try competitions.invite_code (exact match, case-normalized)
      const { data: comp } = await supabase
        .from("competitions")
        .select("id")
        .eq("invite_code", trimmedToken.toLowerCase())
        .in("status", ["draft", "active"])
        .single();

      if (!comp) {
        return NextResponse.json(
          { error: "This code doesn't match any active competition" },
          { status: 404 }
        );
      }
      competitionId = comp.id;
    }
  }

  // 4. Check entrant cap — auto-provision for tournament competitions.
  // MUST use service client: RLS on competition_members requires
  // is_competition_member(), so a non-member's count returns 0 — bypassing the
  // cap. This is the fast path; the DB trigger (step 6) is the race-proof backstop.
  const svc = createServiceClient();
  let tournamentId: string | null = null;
  let instanceType: "full" | "knockout_only" = "full";
  {
    const { data: comp } = await svc
      .from("competitions")
      .select("max_entrants, tournament_id, instance_type")
      .eq("id", competitionId)
      .single();

    tournamentId = comp?.tournament_id ?? null;
    instanceType = (comp?.instance_type as "full" | "knockout_only") ?? "full";

    if (comp?.max_entrants) {
      const { count } = await svc
        .from("competition_members")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competitionId);

      if ((count ?? 0) >= comp.max_entrants) {
        if (tournamentId) {
          // Tournament instance full — find or create a new one
          const { findOrProvisionInstance } = await import("@/lib/tournament/auto-provision");
          competitionId = await findOrProvisionInstance(
            svc,
            tournamentId,
            instanceType,
            user.id
          );
        } else {
          // Non-tournament: hard cap
          return NextResponse.json(
            { error: "Competition is full" },
            { status: 403 }
          );
        }
      }
    }
  }

  // 5. Check if user already a member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Already a member — ensure classification memberships exist (idempotent backfill)
    await enrollEntrant(supabase, competitionId, user.id);

    const { data: comp } = await supabase
      .from("competitions")
      .select("name, product_mode")
      .eq("id", competitionId)
      .single();

    return NextResponse.json({
      competition_id: competitionId,
      competition_name: comp?.name ?? "Competition",
      product_mode: comp?.product_mode ?? null,
      already_member: true,
    });
  }

  // 6. Insert into competition_members. The DB cap trigger rejects the insert
  // if the instance filled since the step-4 pre-check (concurrent join race);
  // the helper then provisions/finds the next instance and retries, so the
  // resolved competitionId may change here.
  try {
    const result = await joinCompetitionWithCap(svc, competitionId, user.id, {
      tournamentId,
      instanceType,
    });
    competitionId = result.competitionId;

    if (result.alreadyMember) {
      const { data: comp } = await supabase
        .from("competitions")
        .select("name, product_mode")
        .eq("id", competitionId)
        .single();

      // Ensure classification memberships exist before returning.
      await enrollEntrant(supabase, competitionId, user.id);

      return NextResponse.json({
        competition_id: competitionId,
        competition_name: comp?.name ?? "Competition",
        product_mode: comp?.product_mode ?? null,
        already_member: true,
      });
    }
  } catch (err) {
    if (err instanceof CompetitionFullError) {
      return NextResponse.json({ error: "Competition is full" }, { status: 403 });
    }
    console.error("Failed to join competition:", err);
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }

  // 7. Enroll in classifications (idempotent — no-op for non-tournament competitions)
  await enrollEntrant(supabase, competitionId, user.id);

  // 7b. Fire-and-forget: push notification to existing members about new join
  {
    const [{ data: joiner }, { data: existingMembers }, { data: comp }] =
      await Promise.all([
        supabase
          .from("users")
          .select("display_name")
          .eq("id", user.id)
          .single(),
        supabase
          .from("competition_members")
          .select("user_id")
          .eq("competition_id", competitionId)
          .neq("user_id", user.id),
        supabase
          .from("competitions")
          .select("name, chat_enabled")
          .eq("id", competitionId)
          .single(),
      ]);

    if (comp?.chat_enabled && existingMembers?.length) {
      const joinerName = joiner?.display_name ?? "Someone";
      const compName = comp.name ?? "the competition";
      for (const member of existingMembers) {
        sendPushToUser(
          member.user_id,
          {
            title: `${joinerName} joined ${compName}`,
            body: `${joinerName} is now a member`,
            url: `/wc/leaderboard`,
            tag: `chat-join-${competitionId}-${user.id}`,
          },
          "chat_member_join",
          { competitionId },
        ).catch(() => {}); // best effort
      }
    }
  }

  // 8. Atomically increment use_count (only for invite_tokens, not permanent invite_codes)
  // Uses SQL `use_count + 1 WHERE use_count < max_uses` to prevent races where
  // two concurrent joins both read the same count and write the same value.
  if (isInviteToken && invite) {
    await supabase.rpc("claim_invite_use", { p_invite_id: invite.id });
  }

  // 9. Fetch competition name + product_mode
  const { data: competition } = await supabase
    .from("competitions")
    .select("name, product_mode")
    .eq("id", competitionId)
    .single();

  return NextResponse.json({
    competition_id: competitionId,
    competition_name: competition?.name ?? "Competition",
    product_mode: competition?.product_mode ?? null,
  });
}
