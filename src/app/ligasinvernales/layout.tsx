import {
  Anton,
  Barlow_Semi_Condensed,
  Bebas_Neue,
  Oswald,
  Saira_Condensed,
} from "next/font/google";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LigasLanguageToggle } from "@/components/ligas/LigasLanguageToggle";

/**
 * /ligasinvernales — Caribbean winter baseball surface.
 *
 * Own layout, separate from the WC surface. Simple branded top nav, no
 * bottom TabBar. No auth requirement here — the hub is public; sub-pages
 * handle their own auth.
 *
 * Per-league display fonts: each league view can render its headlines in its
 * own face (see theme.ts LEAGUE_FONT_VARS + the `font-liga` utility). The
 * families are free Google Fonts chosen to evoke each league; the official
 * proprietary faces can be swapped in here when licensed. Scoped to this
 * layout so the rest of the app keeps the house type system.
 */

const ligaLmp = Barlow_Semi_Condensed({
  variable: "--font-liga-lmp",
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const ligaLvbp = Oswald({
  variable: "--font-liga-lvbp",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const ligaLidom = Anton({
  variable: "--font-liga-lidom",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
const ligaLbprc = Saira_Condensed({
  variable: "--font-liga-lbprc",
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const ligaSdc = Bebas_Neue({
  variable: "--font-liga-sdc",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const ligaFontVars = [
  ligaLmp.variable,
  ligaLvbp.variable,
  ligaLidom.variable,
  ligaLbprc.variable,
  ligaSdc.variable,
].join(" ");

export default function LigasInvernalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-ps-bg ${ligaFontVars}`}>
      <nav className="border-b border-ps-border bg-ps-bg">
        <div className="mx-auto flex h-12 w-full max-w-[480px] items-center justify-between px-4">
          <Link href="/ligasinvernales" className="flex items-center gap-1.5">
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

      <div className="mx-auto max-w-[480px] px-4 pb-16">{children}</div>

      <footer className="flex justify-center py-8">
        <Link href="/" className="opacity-30 transition-opacity hover:opacity-50">
          <BrandMark className="h-6 w-auto" />
        </Link>
      </footer>
    </div>
  );
}
