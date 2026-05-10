import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { BrandMark } from "./BrandMark";

const publicNavLinks = [
  { href: "/predictions", label: "Predictions" },
  { href: "/leaderboard", label: "Table" },
] as const;

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Fetch the user profile from the users table for display_name and avatar
  let profile: { display_name: string; avatar_url: string | null } | null =
    null;
  let isAdmin = false;
  if (authUser) {
    const [profileRes, adminRes] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, avatar_url")
        .eq("id", authUser.id)
        .single(),
      supabase
        .from("competition_members")
        .select("role")
        .eq("user_id", authUser.id)
        .in("role", ["admin", "co_admin"])
        .limit(1),
    ]);
    profile = profileRes.data;
    isAdmin = (adminRes.data?.length ?? 0) > 0;
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
      <div className="mx-auto flex h-12 max-w-[480px] items-center justify-between px-4 sm:px-6">
        {/* Logo: brand mark + wordmark */}
        <Link href="/" className="flex items-center gap-1.5">
          <BrandMark className="h-7 w-auto shrink-0" />
          <span className="text-[1.1rem] font-extrabold lowercase tracking-tight text-ps-text">
            sports<span className="text-ps-amber">predict.</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
            >
              Admin
            </Link>
          )}
        </div>

        {/* Right side: auth + mobile toggle */}
        <div className="flex items-center gap-2">
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
            isAdmin={isAdmin}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </nav>
  );
}
