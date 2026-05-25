import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { BrandMark } from "@/components/BrandMark";

const wcNavLinks = [
  { href: "/wc/picks", label: "Picks" },
  { href: "/wc/bracket", label: "Bracket" },
  { href: "/wc/leaderboard", label: "Table" },
  { href: "/wc/results", label: "Results" },
  { href: "/wc/rules", label: "Rules" },
] as const;

export default async function WorldCupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let profile: { display_name: string; avatar_url: string | null } | null = null;
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
    <div className="wc-theme min-h-screen bg-ps-bg">
      <div className="h-1 w-full" style={{ background: "#006847" }} />
      {/* WC Shell nav */}
      <nav className="bg-ps-bg border-b border-ps-border" style={{ borderTop: "2px solid #006847" }}>
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/wc" className="flex items-center gap-1.5">
            <BrandMark className="h-7 w-auto shrink-0" />
            <span className="text-[1.1rem] font-extrabold lowercase tracking-tight text-ps-text">
              sports<span className="text-ps-amber">predict.</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {wcNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {authUser ? (
            <UserMenu displayName={displayName} avatarUrl={avatarUrl} />
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-ps-text px-3 py-1.5 text-sm font-semibold text-ps-bg"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile tab bar */}
        <div className="flex overflow-x-auto border-t border-ps-border md:hidden">
          <div className="mx-auto flex max-w-3xl px-2">
            {wcNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      {/* Footer brand mark — Section 21 */}
      <footer className="flex justify-center py-8">
        <Link href="/" className="opacity-30 transition-opacity hover:opacity-50">
          <BrandMark className="h-6 w-auto" />
        </Link>
      </footer>
    </div>
  );
}
