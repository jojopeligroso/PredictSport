import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { ChatPageClient } from "./ChatPageClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const t = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/chat");
  }

  // Find the WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, chat_enabled")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  if (!competition || !competition.chat_enabled) {
    redirect("/wc/home");
  }

  // Verify membership + get role
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

  if (!membership) {
    redirect("/wc/home");
  }

  return (
    <ChatPageClient
      competitionId={competition.id}
      competitionName={competition.name ?? "WC Predict"}
      currentUserId={user.id}
      currentUserRole={membership.role ?? "participant"}
      memberCount={memberCount ?? 0}
    />
  );
}
