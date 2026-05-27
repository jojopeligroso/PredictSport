"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface WcMoreMenuProps {
  variant: "desktop" | "mobile";
}

export function WcMoreMenu({ variant }: WcMoreMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
  }, []);

  const panel = (
    <div
      role="menu"
      className={
        variant === "desktop"
          ? "absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-ps-border bg-ps-surface py-1 shadow-[0_4px_16px_rgba(25,21,18,0.12)]"
          : "absolute bottom-full left-1/2 z-50 mb-1 w-64 -translate-x-1/2 rounded-lg border border-ps-border bg-ps-surface py-1 shadow-[0_-4px_16px_rgba(25,21,18,0.12)]"
      }
    >
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
    </div>
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
        {isOpen && panel}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
      >
        More
      </button>
      {isOpen && panel}
    </div>
  );
}
