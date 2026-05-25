import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { BrandMark } from "./BrandMark";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Fetch the user profile from the users table for display_name and avatar
  let profile: { display_name: string; avatar_url: string | null } | null =
    null;
  if (authUser) {
    const profileRes = await supabase
      .from("users")
      .select("display_name, avatar_url")
      .eq("id", authUser.id)
      .single();
    profile = profileRes.data;
  }

  const displayName =
    profile?.display_name ??
    authUser?.user_metadata?.full_name ??
    authUser?.email ??
    "User";
  const avatarUrl =
    profile?.avatar_url ?? authUser?.user_metadata?.avatar_url ?? null;

  return (
    <nav className="relative bg-ps-bg">
      <div className="mx-auto grid h-12 w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
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
              <UserMenu displayName={displayName} avatarUrl={avatarUrl} />
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
          />
        </div>
      </div>
    </nav>
  );
}
