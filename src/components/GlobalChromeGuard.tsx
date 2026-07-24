"use client";

import { usePathname } from "next/navigation";

export function GlobalChromeGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/wc")) return null;
  if (pathname.startsWith("/ligasinvernales")) return null;
  if (pathname.startsWith("/hundred")) return null;
  return <>{children}</>;
}
