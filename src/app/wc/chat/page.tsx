import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { ChatPageClient } from "./ChatPageClient";
import { ChatPreview } from "@/components/chat/ChatPreview";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const t = await getServerT();
  const { competition, user, isMember } = await resolveWcCompetition();

  if (!competition || !competition.chat_enabled) {
    redirect("/wc/home");
  }

  // Non-member or unauthenticated: show preview instead of redirecting
  if (!user || !isMember) {
    // Superadmins who aren't members still get full chat
    let isSuperAdmin = false;
    if (user) {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from("users")
        .select("is_super_admin")
        .eq("id", user.id)
        .single();
      isSuperAdmin = profile?.is_super_admin === true;
    }

    if (!isSuperAdmin) {
      return (
        <div className="mx-auto w-full max-w-[480px] px-4 py-6">
          <ChatPreview />
        </div>
      );
    }
  }

  if (!user) {
    // Shouldn't reach here, but guard for TypeScript
    redirect("/login?next=/wc/chat");
  }

  const supabase = await createClient();

  // Get role + member count
  const [{ data: membership }, { count: memberCount }] = await Promise.all([
    supabase
      .from("competition_members")
      .select("role")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competition.id),
  ]);

  return (
    <ChatPageClient
      competitionId={competition.id}
      competitionName={competition.name ?? "WC Predict"}
      currentUserId={user.id}
      currentUserRole={membership?.role ?? "participant"}
      memberCount={memberCount ?? 0}
    />
  );
}
