"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const wcNavLinks = [
  { href: "/wc/picks", label: "Picks" },
  { href: "/wc/bracket", label: "Bracket" },
  { href: "/wc/leaderboard", label: "Table" },
  { href: "/wc/results", label: "Results" },
  { href: "/wc/rules", label: "Rules" },
] as const;

/**
 * WC shell navigation links — rendered in two slots (desktop inline inside
 * the nav bar flex row, mobile tab bar below it).
 *
 * Hidden on the /wc landing page when the user hasn't started engaging
 * (visitor, first login, or bracket not yet started). Once the user has
 * begun their bracket the full nav appears everywhere.
 */
export function WcNavLinks({
  engaged,
  variant,
  isWcAdmin,
}: {
  engaged: boolean;
  variant: "desktop" | "mobile";
  isWcAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isLanding = pathname === "/wc";

  if (isLanding && !engaged) return null;

  if (variant === "desktop") {
    return (
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
        {isWcAdmin && (
          <Link
            href="/wc/admin"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
          >
            Admin
          </Link>
        )}
      </div>
    );
  }

  return (
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
        {isWcAdmin && (
          <Link
            href="/wc/admin"
            className="shrink-0 px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
          >
            Admin
          </Link>
        )}
      </div>
    </div>
  );
}
