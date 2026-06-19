import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, type CompetitionRef } from "./ProfileForm";
import type { User, CompetitionType } from "@/types/database";

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
      "id, email, display_name, avatar_url, is_super_admin, notification_prefs, telegram_id, telegram_username, display_name_updated_at, created_at"
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Competitions this user is a member of — used by the per-comp notification
  // mute toggles in Settings. Personal comp included so the user can silence
  // their own pick-journal reminders.
  const { data: memberRows } = await supabase
    .from("competition_members")
    .select("competition_id, competitions(id, name, type)")
    .eq("user_id", user.id);

  type CompRow = { id: string; name: string | null; type: CompetitionType | null };
  const competitions: CompetitionRef[] = (memberRows ?? [])
    .map((row) => {
      // Supabase's inferred type sometimes models the to-one relation as an array.
      // Handle both shapes; at runtime FK competition_id resolves to one row.
      const raw = (row as { competitions: CompRow | CompRow[] | null }).competitions;
      if (!raw) return null;
      return Array.isArray(raw) ? (raw[0] ?? null) : raw;
    })
    .filter((c): c is CompRow => c !== null && typeof c.id === "string")
    .map((c) => ({
      id: c.id,
      name: c.name ?? "Competition",
      type: c.type ?? "open",
    }))
    .sort((a, b) => {
      // Personal at the bottom; others alphabetical
      if (a.type === "personal" && b.type !== "personal") return 1;
      if (b.type === "personal" && a.type !== "personal") return -1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display font-extrabold text-2xl uppercase tracking-[0.06em] text-ps-text">
        Settings
      </h1>
      <ProfileForm user={profile as User} competitions={competitions} />
    </div>
  );
}
