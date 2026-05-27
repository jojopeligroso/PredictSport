import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { BrandMark } from "./BrandMark";
import { DisplayNameModal } from "./DisplayNameModal";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Fetch the user profile from the users table for display_name and avatar
  let profile: { display_name: string; avatar_url: string | null; is_super_admin: boolean | null } | null =
    null;
  let isAdmin = false;
  if (authUser) {
    const [profileRes, adminRes] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, avatar_url, is_super_admin")
        .eq("id", authUser.id)
        .single(),
      supabase
        .from("competition_members")
        .select("competition_id")
        .eq("user_id", authUser.id)
        .in("role", ["admin", "co_admin"])
        .limit(1),
    ]);
    profile = profileRes.data;
    isAdmin = ((adminRes.data ?? []).length > 0);
  }

  const isSuperAdmin = profile?.is_super_admin === true;

  const displayName =
    profile?.display_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.email ||
    "User";
  const avatarUrl =
    profile?.avatar_url ?? authUser?.user_metadata?.avatar_url ?? null;

  const needsDisplayName = !!authUser && !profile?.display_name;
  const suggestedName = authUser?.user_metadata?.full_name ?? authUser?.email?.split("@")[0] ?? "";

  return (
    <>
    <nav className="relative bg-ps-bg">
      <div className="mx-auto grid h-12 w-full max-w-md grid-cols-[1fr_auto_1fr] items-center px-4">
        {/* Left spacer */}
        <div />

        {/* Center: brand mark + wordmark */}
        <Link href="/" className="flex items-center gap-1.5">
          <BrandMark className="h-7 w-auto shrink-0" />
          <span className="text-[1.1rem] font-extrabold lowercase tracking-tight text-ps-text">
            sports<span className="text-ps-amber">predict.</span>
          </span>
        </Link>

        {/* Right: auth + mobile toggle */}
        <div className="flex items-center justify-end gap-2">
          {/* Desktop auth */}
          <div className="hidden md:block">
            {authUser ? (
              <UserMenu displayName={displayName} avatarUrl={avatarUrl} isAdmin={isAdmin || isSuperAdmin} />
            ) : (
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              >
                Log in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <MobileNav
            isLoggedIn={!!authUser}
            displayName={displayName}
            avatarUrl={avatarUrl}
            isAdmin={isAdmin || isSuperAdmin}
          />
        </div>
      </div>
    </nav>
    {needsDisplayName && <DisplayNameModal suggestedName={suggestedName} />}
    </>
  );
}
