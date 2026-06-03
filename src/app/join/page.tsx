import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";
import { BrandMark } from "@/components/BrandMark";
import { JoinCard } from "./join-card";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token;

  // No token provided — redirect home
  if (!token) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — show login with redirect back
  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

          {/* Logo row */}
          <div className="mb-4 flex items-center gap-2.5">
            <BrandMark className="h-11 w-auto shrink-0" />
            <div>
              <p className="text-base font-extrabold lowercase leading-tight tracking-tight text-ps-text">
                sports<span className="text-ps-amber">predict.</span>
              </p>
              <p className="font-serif text-[11.5px] italic leading-tight text-ps-text-sec">
                Sign in to join
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-snug text-ps-text">
            You&apos;ve been invited to put your money where your mouth is. Without the money. Sign in to join.
          </p>

          <LoginButton
            redirectTo={`/join?token=${encodeURIComponent(token)}`}
          />
        </div>
      </div>
    );
  }

  // Authenticated — look up token: try invite_tokens first, then competitions.invite_code
  const { data: invite } = await supabase
    .from("invite_tokens")
    .select("*, competitions(id, name)")
    .eq("token", token)
    .single();

  let competitionId: string;
  let competitionName: string;

  if (invite) {
    const comp = (invite as Record<string, unknown>).competitions as {
      id: string;
      name: string;
    } | null;
    competitionId = invite.competition_id;
    competitionName = comp?.name ?? "Competition";

    // Token expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />
            <div className="rounded-xl border border-ps-red bg-ps-red-soft p-4 text-sm text-ps-red">
              This invite link has expired.
            </div>
          </div>
        </div>
      );
    }

    // Max uses reached
    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />
            <div className="rounded-xl border border-ps-red bg-ps-red-soft p-4 text-sm text-ps-red">
              This invite link has reached its maximum uses.
            </div>
          </div>
        </div>
      );
    }
  } else {
    // Try competitions.invite_code (case-insensitive)
    const { data: comp } = await supabase
      .from("competitions")
      .select("id, name")
      .ilike("invite_code", token.trim())
      .in("status", ["draft", "active"])
      .single();

    if (!comp) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />
            <div className="rounded-xl border border-ps-red bg-ps-red-soft p-4 text-sm text-ps-red">
              This code doesn&apos;t match any active competition.
            </div>
          </div>
        </div>
      );
    }
    competitionId = comp.id;
    competitionName = comp.name;
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    redirect(`/predictions?competition=${competitionId}`);
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from("competition_members")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <JoinCard
        token={token}
        competitionName={competitionName}
        memberCount={memberCount ?? 0}
      />
    </div>
  );
}
