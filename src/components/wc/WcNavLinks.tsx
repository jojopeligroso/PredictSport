"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * WC shell navigation — three top-level pills: Home · Matches · Rules.
 * Active pill gets a gold underline. Bracket, Profile & Settings, and
 * Admin are in the hamburger menu (MobileNav).
 *
 * Hidden on landing pages when the user hasn't engaged (visitor / first
 * login). Once the user has joined the WC competition the nav shows
 * everywhere.
 */
export function WcNavLinks({
  engaged,
  variant,
}: {
  engaged: boolean;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const t = useT();

  const links = [
    { href: "/wc/home", label: t("nav.home") },
    { href: "/wc", label: t("nav.matches") },
    { href: "/wc/rules", label: t("nav.rules") },
  ];

  // Only hide nav on the landing page (/wc) for non-engaged visitors.
  // /wc/home always shows nav — it's the authenticated dashboard.
  const isLanding = pathname === "/wc";

  if (isLanding && !engaged) return null;

  /** Match active link — /wc/home is exact, /wc (Matches) matches /wc and /wc/picks/*, others match prefix. */
  function isActive(href: string) {
    if (href === "/wc/home") return pathname === "/wc/home";
    if (href === "/wc") return pathname === "/wc" || pathname.startsWith("/wc/picks");
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (variant === "desktop") {
    return (
      <div className="hidden items-center gap-1 md:flex">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors transition-transform active:scale-[0.97] duration-75",
                active
                  ? "text-ps-text"
                  : "text-ps-text-sec hover:bg-ps-chip hover:text-ps-text",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex justify-center border-t border-ps-border px-2 md:hidden">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "shrink-0 px-3 py-2 min-h-[44px] flex items-center text-xs font-semibold transition-colors transition-transform active:scale-95 active:bg-ps-chip active:rounded-md duration-75",
              active
                ? "border-b-2 border-ps-amber text-ps-text"
                : "text-ps-text-sec hover:text-ps-text",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
