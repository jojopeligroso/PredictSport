"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

const publicNavLinks = [
  { href: "/competitions/personal", label: "Predictions" },
  { href: "/leaderboard", label: "Table" },
  { href: "/competitions", label: "Competitions" },
] as const;

interface MobileNavProps {
  isLoggedIn: boolean;
  displayName: string;
  avatarUrl: string | null;
  extraNavLinks?: { href: string; label: string }[];
}

export function MobileNav({ isLoggedIn, displayName, avatarUrl, extraNavLinks = [] }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
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
        <div className="absolute left-0 right-0 top-12 z-50 animate-in fade-in slide-in-from-top-1 border-b border-ps-border bg-ps-surface duration-150 ease-out">
          <div className="space-y-1 px-4 py-3">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              >
                {link.label}
              </Link>
            ))}
            {extraNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-bold text-ps-amber transition-colors hover:bg-ps-chip"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-ps-border px-4 py-3">
            {isLoggedIn ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-1">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ps-chip text-xs font-medium text-ps-text-sec">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-ps-text">
                    {displayName}
                  </span>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                >
                  Profile
                </Link>
                <LogoutButton />
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block rounded-md bg-ps-text px-4 py-2 text-center text-sm font-medium text-ps-bg transition-colors hover:opacity-90"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
