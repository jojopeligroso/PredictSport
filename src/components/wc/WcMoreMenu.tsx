"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface WcMoreMenuProps {
  variant: "desktop" | "mobile";
  isWcAdmin?: boolean;
}

export function WcMoreMenu({ variant, isWcAdmin }: WcMoreMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (variant === "mobile") return; // mobile uses backdrop
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, variant]);

  const menuItems = (
    <>
      {isWcAdmin && (
        <Link
          href="/wc/admin"
          role="menuitem"
          className="block px-4 py-2.5 transition-colors hover:bg-ps-chip"
          onClick={() => setIsOpen(false)}
        >
          <span className="block text-sm font-medium text-ps-text">Admin</span>
          <span className="mt-0.5 block text-xs text-ps-text-ter">
            Manage competition
          </span>
        </Link>
      )}
      <Link
        href="/wc/bracket"
        role="menuitem"
        className="block px-4 py-2.5 transition-colors hover:bg-ps-chip"
        onClick={() => setIsOpen(false)}
      >
        <span className="block text-sm font-medium text-ps-text">
          Bracket prediction
        </span>
        <span className="mt-0.5 block text-xs text-ps-text-ter">
          Advanced — not for casuals
        </span>
      </Link>
      <a
        href="https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026/standings"
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        className="block px-4 py-2.5 transition-colors hover:bg-ps-chip"
        onClick={() => setIsOpen(false)}
      >
        <span className="block text-sm font-medium text-ps-text">
          Group standings
        </span>
        <span className="mt-0.5 block text-xs text-ps-text-ter">
          Official FIFA tables ↗
        </span>
      </a>
    </>
  );

  if (variant === "desktop") {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
        >
          More
        </button>
        {isOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-ps-border bg-ps-surface py-1 shadow-[0_4px_16px_rgba(25,21,18,0.12)]"
          >
            {menuItems}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
      >
        More
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="menu"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-ps-border bg-ps-surface pb-8 pt-2 shadow-[0_-4px_16px_rgba(25,21,18,0.12)]"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ps-border" />
            {menuItems}
          </div>
        </>
      )}
    </div>
  );
}
