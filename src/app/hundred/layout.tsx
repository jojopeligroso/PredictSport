import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

/**
 * /hundred — The Hundred (English cricket) surface.
 *
 * Own layout, separate from the WC surface. English only — no language
 * toggle. Simple branded top nav, no bottom TabBar. The hub is public;
 * sub-pages handle their own auth.
 */
export default function HundredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ps-bg">
      <nav className="border-b border-ps-border bg-ps-bg">
        <div className="mx-auto flex h-12 w-full max-w-[480px] items-center justify-between px-4">
          <Link href="/hundred" className="flex items-center gap-1.5">
            <BrandMark className="h-7 w-auto shrink-0" />
            <span className="font-display font-extrabold lowercase tracking-tight text-ps-text">
              the hundred<span className="text-ps-amber">.</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-ps-text-sec hover:text-ps-text"
          >
            sports<span className="text-ps-amber">predict.</span>
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-[480px] px-4 pb-16">{children}</div>

      <footer className="flex justify-center py-8">
        <Link href="/" className="opacity-30 transition-opacity hover:opacity-50">
          <BrandMark className="h-6 w-auto" />
        </Link>
      </footer>
    </div>
  );
}
