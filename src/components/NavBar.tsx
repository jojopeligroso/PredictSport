import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";

const navLinks = [
  { href: "/predictions", label: "Predictions" },
  { href: "/leaderboard", label: "Table" },
  { href: "/admin", label: "Admin" },
] as const;

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Fetch the user profile from the users table for display_name and avatar
  let profile: { display_name: string; avatar_url: string | null } | null =
    null;
  if (authUser) {
    const { data } = await supabase
      .from("users")
      .select("display_name, avatar_url")
      .eq("id", authUser.id)
      .single();
    profile = data;
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
      <div className="mx-auto flex h-12 max-w-[600px] items-center justify-between px-4 sm:px-6">
        {/* Logo: 28px square + wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#d97706]"
            aria-hidden="true"
          >
            <span className="font-display text-base leading-none tracking-wide text-[#1c1917]">
              PS
            </span>
          </div>
          <span className="text-lg uppercase tracking-wide">
            <span className="font-light text-ps-text">Predict</span>
            <span className="font-bold text-ps-amber-deep">Sport</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
            >
              {link.label}
            </Link>
          ))}
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
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </nav>
  );
}
