import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import type { User } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, email, display_name, avatar_url, is_super_admin, notification_prefs, telegram_id, telegram_username, created_at"
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-light text-2xl uppercase tracking-[0.06em] text-ps-text">
        Profile
      </h1>
      <ProfileForm user={profile as User} />
    </div>
  );
}
