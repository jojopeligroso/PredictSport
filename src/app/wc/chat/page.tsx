import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { ChatPageClient } from "./ChatPageClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const t = await getServerT();
  const { competition, user, isMember } = await resolveWcCompetition();

  if (!user) {
    redirect("/login?next=/wc/chat");
  }

  if (!competition || !competition.chat_enabled) {
    redirect("/wc/home");
  }

  if (!isMember) {
    redirect("/wc/home");
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
