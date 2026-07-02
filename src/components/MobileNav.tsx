"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { useT } from "@/lib/i18n";
import { useUnreadChat } from "@/hooks/useUnreadChat";

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
  const t = useT();
  const { hasUnread, markSeen } = useUnreadChat(latestChatAt);

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
    <div className="flex items-center" ref={menuRef}>
      {/* User avatar (always visible in nav bar) */}
      {isLoggedIn && (
        <span className="pointer-events-none flex items-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ps-chip text-xs font-medium text-ps-text-sec">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      )}
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-ps-text-sec transition-colors transition-transform duration-150 hover:bg-ps-chip active:scale-[0.92] active:bg-ps-amber/10"
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
                <div>
                  {/* Navigation links */}
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-ps-text-sec transition-colors transition-transform hover:bg-ps-chip hover:text-ps-text active:scale-[0.98] duration-75"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    {t("menu.settings")}
                  </Link>
                  <Link
                    href="/wc/leaderboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-ps-text-sec transition-colors transition-transform hover:bg-ps-chip hover:text-ps-text active:scale-[0.98] duration-75"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m6-6V6.375a3.375 3.375 0 0 0-3-3.354V3m0 0a3.375 3.375 0 0 0-3 3.354V10.5" />
                    </svg>
                    {t("nav.leaderboard")}
                  </Link>
                  <Link
                    href="/wc/chat"
                    onClick={() => {
                      setIsOpen(false);
                      markSeen();
                    }}
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-ps-text-sec transition-colors transition-transform hover:bg-ps-chip hover:text-ps-text active:scale-[0.98] duration-75"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    {t("dash.chat")}
                    {hasUnread && (
                      <span className="h-2 w-2 rounded-full bg-ps-amber" aria-label="New chat messages" />
                    )}
                  </Link>
                  {extraLinks?.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors transition-transform hover:bg-ps-chip hover:text-ps-text active:scale-[0.98] duration-75"
                    >
                      {link.label}
                    </Link>
                  ))}
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
