"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useUnreadChat } from "@/hooks/useUnreadChat";

/* ── Icons ──────────────────────────────────────────────────────────── */

function IconHome() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.75L12 3l9 6.75V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.75z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function IconCrosshair() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx={12} cy={12} r={7} />
      <line x1={12} y1={2} x2={12} y2={5} />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={2} y1={12} x2={5} y2={12} />
      <line x1={19} y1={12} x2={22} y2={12} />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2h12v8a6 6 0 0 1-12 0V2z" />
      <path d="M6 5H3a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M18 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
    </svg>
  );
}

/* ── Tab definitions ────────────────────────────────────────────────── */

type TabDef = {
  key: string;
  href: string;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
  badge?: number;
};

/* ── Component ──────────────────────────────────────────────────────── */

interface TabBarProps {
  /** ISO timestamp of the latest chat message (for unread badge). */
  latestChatAt?: string | null;
}

/**
 * Fixed bottom tab bar for the /wc section.
 *
 * Usage:
 *   import { TabBar } from "@/components/wc/TabBar";
 *   // Place inside the /wc layout, outside any scrolling container
 *   <TabBar latestChatAt={latestChatAt} />
 */
export function TabBar({ latestChatAt }: TabBarProps) {
  const pathname = usePathname();
  const t = useT();
  const { unreadCount } = useUnreadChat(latestChatAt);

  const tabs: TabDef[] = [
    {
      key: "tab.home",
      href: "/wc/home",
      icon: <IconHome />,
      isActive: (p) => p.startsWith("/wc/home"),
    },
    {
      key: "tab.picks",
      href: "/wc",
      icon: <IconCrosshair />,
      isActive: (p) => p === "/wc" || p.startsWith("/wc/picks"),
    },
    {
      key: "tab.board",
      href: "/wc/leaderboard",
      icon: <IconTrophy />,
      isActive: (p) => p.startsWith("/wc/leaderboard"),
    },
    {
      key: "tab.chat",
      href: "/wc/chat",
      icon: <IconChat />,
      isActive: (p) => p.startsWith("/wc/chat"),
      badge: unreadCount,
    },
  ];

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        paddingBottom: "env(safe-area-inset-bottom)",
        touchAction: "manipulation",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      className="border-t border-ps-border bg-ps-bg"
    >
      <div className="mx-auto flex h-[56px] max-w-[480px] items-stretch">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-label={t(tab.key)}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative flex flex-1 flex-col items-center justify-center gap-px transition-colors duration-150",
                active ? "text-ps-amber" : "text-ps-text-ter",
              ].join(" ")}
            >
              {/* Background pill — visible on active tab + press */}
              <span
                className={[
                  "absolute inset-x-2 inset-y-1 rounded-xl transition-colors duration-150",
                  active
                    ? "bg-ps-amber/10"
                    : "bg-transparent group-active:bg-ps-text/10",
                ].join(" ")}
                aria-hidden
              />
              <span className="relative">
                {tab.icon}
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-ps-amber px-0.5 text-micro font-bold leading-none text-white">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </span>
              <span
                className="relative text-micro font-semibold uppercase tracking-wider leading-none"
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
