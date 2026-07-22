import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LigasLanguageToggle } from "@/components/ligas/LigasLanguageToggle";
import { LigasTabBar } from "@/components/ligas/LigasTabBar";

/**
 * /ligas-invernales — Caribbean winter baseball surface.
 *
 * Own layout, separate from the WC surface. Simple branded top nav, no
 * bottom TabBar. No auth requirement here — the hub is public; sub-pages
 * handle their own auth.
 */
export default function LigasInvernalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ps-bg">
      <nav className="border-b border-ps-border bg-ps-bg">
        <div className="mx-auto flex h-12 w-full max-w-[480px] items-center justify-between px-4">
          <Link href="/ligas-invernales" className="flex items-center gap-1.5">
            <BrandMark className="h-7 w-auto shrink-0" />
            <span className="font-display font-extrabold lowercase tracking-tight text-ps-text">
              ligas invernales<span className="text-ps-amber">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LigasLanguageToggle />
            <Link
              href="/"
              className="text-xs font-semibold text-ps-text-sec hover:text-ps-text"
            >
              sports<span className="text-ps-amber">predict.</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[480px] px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </div>

      <footer className="flex justify-center pb-[calc(64px+env(safe-area-inset-bottom))] pt-8">
        <Link href="/" className="opacity-30 transition-opacity hover:opacity-50">
          <BrandMark className="h-6 w-auto" />
        </Link>
      </footer>

      {/* Fixed bottom nav — only renders inside a single league. */}
      <LigasTabBar />
    </div>
  );
}
