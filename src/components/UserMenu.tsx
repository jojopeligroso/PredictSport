"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { useTheme } from "./ThemeProvider";
import { useT } from "@/lib/i18n";

interface UserMenuProps {
  displayName: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export function UserMenu({ displayName, avatarUrl, isAdmin }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, cycleTheme } = useTheme();
  const t = useT();

  const themeLabel = {
    light: t("onboarding.theme_light"),
    dark: t("onboarding.theme_dark"),
    system: t("onboarding.theme_system"),
  }[theme];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative hidden md:block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-ps-chip"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
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
        <span className="max-w-[120px] truncate text-ps-text-sec">
          {displayName}
        </span>
        <svg
          className={`h-4 w-4 text-ps-text-ter transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-ps-border bg-ps-surface py-1 shadow-[0_4px_16px_rgba(25,21,18,0.12)]">
          <div className="border-b border-ps-border px-4 py-2">
            <p className="truncate text-sm font-medium text-ps-text">
              {displayName}
            </p>
          </div>
          <div className="px-2 py-1">
            <Link
              href="/profile"
              className="block rounded-md px-2 py-1.5 text-sm text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              onClick={() => setIsOpen(false)}
            >
              {t("menu.profile")}
            </Link>
            <Link
              href="/profile#settings"
              className="block rounded-md px-2 py-1.5 text-sm text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              onClick={() => setIsOpen(false)}
            >
              {t("menu.settings")}
            </Link>
            {process.env.NEXT_PUBLIC_PRODUCT_MODE !== "world_cup_2026_shell" && (
              <Link
                href="/competitions"
                className="block rounded-md px-2 py-1.5 text-sm text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
                onClick={() => setIsOpen(false)}
              >
                {t("menu.my_competitions")}
              </Link>
            )}
            <button
              type="button"
              onClick={cycleTheme}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
              aria-label={`${t("menu.theme")}: ${themeLabel}. Click to change.`}
            >
              <span>{t("menu.theme")}</span>
              <span className="text-xs font-semibold text-ps-text-ter">
                {themeLabel}
              </span>
            </button>
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
