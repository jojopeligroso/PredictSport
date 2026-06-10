"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { useTheme } from "./ThemeProvider";
import { useT } from "@/lib/i18n";

interface MobileNavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  isLoggedIn: boolean;
  displayName: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
  extraLinks?: MobileNavLink[];
  /** ISO timestamp of the latest chat message (for unread badge) */
  latestChatAt?: string | null;
}

export function MobileNav({ isLoggedIn, displayName, avatarUrl, isAdmin, extraLinks, latestChatAt }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, cycleTheme } = useTheme();
  const t = useT();

  const themeLabel = {
    light: t("onboarding.theme_light"),
    dark: t("onboarding.theme_dark"),
    system: t("onboarding.theme_system"),
  }[theme];

  // Unread badge: compare latest chat message with localStorage last-seen
  const [hasUnread, setHasUnread] = useState(() => {
    if (typeof window === "undefined" || !latestChatAt) return false;
    try {
      const lastSeen = localStorage.getItem("chat-last-seen");
      return !lastSeen || new Date(latestChatAt) > new Date(lastSeen);
    } catch { return false; }
  });

  // Close on outside tap
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden" ref={menuRef}>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-ps-text-sec transition-colors duration-150 hover:bg-ps-chip"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        )}
      </button>

      {/* Mobile menu panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-12 z-50 animate-in fade-in slide-in-from-top-1 border-b border-ps-border bg-ps-surface shadow-lg duration-150 ease-out">
          <div className="px-4 py-3">
            {isLoggedIn ? (
              <>
                {/* User header */}
                <div className="flex items-center gap-2.5 pb-2.5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ps-chip text-sm font-medium text-ps-text-sec">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-ps-text">
                    {displayName}
                  </span>
                </div>

                <div className="border-t border-ps-border pt-1.5">
                  {/* Navigation links */}
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                  >
                    {t("menu.profile")}
                  </Link>
                  <Link
                    href="/wc/leaderboard"
                    onClick={() => {
                      setIsOpen(false);
                      setHasUnread(false);
                      try {
                        localStorage.setItem("chat-last-seen", new Date().toISOString());
                      } catch { /* ignore */ }
                    }}
                    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                  >
                    {t("nav.leaderboard")}
                    {hasUnread && (
                      <span className="h-2 w-2 rounded-full bg-ps-amber" aria-label="New chat messages" />
                    )}
                  </Link>
                  {extraLinks?.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                    >
                      {link.label}
                    </Link>
                  ))}

                  {/* Theme toggle */}
                  <button
                    type="button"
                    onClick={cycleTheme}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                    aria-label={`${t("menu.theme")}: ${themeLabel}. Tap to change.`}
                  >
                    <span>{t("menu.theme")}</span>
                    <span className="text-xs font-semibold text-ps-text-ter">
                      {themeLabel}
                    </span>
                  </button>
                </div>

                {/* Log out — separated */}
                <div className="mt-1 border-t border-ps-border pt-1.5">
                  <LogoutButton />
                </div>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block rounded-md bg-ps-text px-4 py-2 text-center text-sm font-medium text-ps-bg transition-colors hover:opacity-90"
              >
                {t("common.log_in")}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
