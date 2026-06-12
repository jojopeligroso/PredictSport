import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { BrandMark } from "@/components/BrandMark";
import { WcNavLinks } from "@/components/wc/WcNavLinks";
import { TabBar } from "@/components/wc/TabBar";
import { getWcBracketSnapshot } from "@/lib/tournament/bracket-snapshot";
import { DisplayNameModal } from "@/components/DisplayNameModal";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getServerT } from "@/lib/i18n/server";

export default async function WorldCupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let profile: { display_name: string; avatar_url: string | null; is_super_admin: boolean | null } | null = null;
  if (authUser) {
    const { data } = await supabase
      .from("users")
      .select("display_name, avatar_url, is_super_admin")
      .eq("id", authUser.id)
      .single();
    profile = data;
  }

  // "Engaged" = user has either started their bracket OR joined the WC
  // competition. With the picks-first /wc landing (ADR 0014), joining the
  // competition is the meaningful signal that the user wants the full nav —
  // they no longer need to touch the bracket to be considered engaged.
  let isAdmin = false;
  let isWcMember = false;
  const [bracket, wcComp] = await Promise.all([
    authUser ? getWcBracketSnapshot(supabase, authUser.id) : Promise.resolve(null),
    supabase
      .from("competitions")
      .select("id")
      .eq("product_mode", "world_cup_2026_shell")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data),
    // Admin/co-admin check across any competition (unchanged from before).
    authUser
      ? supabase
          .from("competition_members")
          .select("competition_id")
          .eq("user_id", authUser.id)
          .in("role", ["admin", "co_admin"])
          .limit(1)
          .then(({ data }) => {
            isAdmin = ((data ?? []).length > 0);
          })
      : Promise.resolve(),
    // WC membership check — drives engaged on the new picks-first landing.
    authUser
      ? supabase
          .from("competition_members")
          .select("competition_id, competitions!inner(product_mode)")
          .eq("user_id", authUser.id)
          .eq("competitions.product_mode", "world_cup_2026_shell")
          .limit(1)
          .then(({ data }) => {
            isWcMember = ((data ?? []).length > 0);
          })
      : Promise.resolve(),
  ]);

  // WC admin: check membership of the specific WC competition
  let isWcAdmin = false;
  if (authUser && wcComp?.id) {
    const { data: wcMembership } = await supabase
      .from("competition_members")
      .select("role")
      .eq("competition_id", wcComp.id)
      .eq("user_id", authUser.id)
      .in("role", ["admin", "co_admin"])
      .maybeSingle();
    isWcAdmin = !!wcMembership;
  } else if (authUser && !wcComp) {
    // No WC competition yet — super admin can access to create one
    isWcAdmin = profile?.is_super_admin === true;
  }

  // Latest non-join chat message (for unread badge on TabBar + MobileNav)
  let latestChatAt: string | null = null;
  if (authUser && wcComp?.id) {
    const { data: latestMsg } = await supabase
      .from("chat_messages")
      .select("created_at")
      .eq("competition_id", wcComp.id)
      .neq("message_type", "system_join")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestChatAt = latestMsg?.created_at ?? null;
  }

  const t = await getServerT();

  const bracketStarted =
    bracket != null && bracket.stage !== "not_started";
  const engaged = bracketStarted || isWcMember;

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
    <div className="wc-theme min-h-screen bg-ps-bg">
      <div className="h-1 w-full" style={{ background: "#006847" }} />
      {/* WC Shell nav */}
      <nav className="bg-ps-bg border-b border-ps-border pb-0.5" style={{ borderTop: "2px solid #006847" }}>
        <div className="mx-auto flex h-12 w-full max-w-[480px] items-center justify-between px-4">
          <Link href="/wc" className="flex items-center gap-1.5">
            <BrandMark className="h-7 w-auto shrink-0" />
            <span className="text-[1.1rem] font-extrabold lowercase tracking-tight text-ps-text">
              sports<span className="text-ps-amber">predict.</span>
            </span>
          </Link>

          <WcNavLinks engaged={engaged} variant="desktop" />

          <div className="flex items-center gap-1">
            <LanguageToggle />
            {authUser ? (
              <UserMenu displayName={displayName} avatarUrl={avatarUrl} isAdmin={isAdmin || isWcAdmin} />
            ) : (
              <Link
                href="/login"
                className="hidden rounded-lg bg-ps-text px-3 py-1.5 text-sm font-semibold text-ps-bg md:block"
              >
                {t('common.sign_in')}
              </Link>
            )}
            <MobileNav
              isLoggedIn={!!authUser}
              displayName={displayName}
              avatarUrl={avatarUrl}
              isAdmin={isAdmin || isWcAdmin}
              extraLinks={[
                { href: "/wc/bracket", label: "Bracket prediction" },
                ...(isWcAdmin ? [{ href: "/wc/admin", label: "Admin" }] : []),
              ]}
              latestChatAt={latestChatAt}
            />
          </div>
        </div>

        <WcNavLinks engaged={engaged} variant="mobile" />
      </nav>

      {needsDisplayName && <DisplayNameModal suggestedName={suggestedName} />}
      <div className="flex-1" style={{ paddingBottom: 'calc(52px + env(safe-area-inset-bottom, 0px) + 16px)' }}>{children}</div>

      {/* Footer brand mark — Section 21 */}
      <footer className="flex justify-center py-8">
        <Link href="/" className="opacity-30 transition-opacity hover:opacity-50">
          <BrandMark className="h-6 w-auto" />
        </Link>
      </footer>

      {engaged && <TabBar latestChatAt={latestChatAt} />}
    </div>
  );
}
