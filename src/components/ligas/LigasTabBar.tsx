"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { ligaVars, LEAGUE_THEMES } from "@/components/ligas/theme";

/**
 * LigasTabBar — fixed bottom navigation, shown only once the entrant is inside
 * a single league (entrants focus on one league at a time). Themed to that
 * league's accent via the `liga` token.
 *
 * Hidden on the hub (`/ligas-invernales`) and the unified `/todas` view, where
 * no single league is in focus.
 */

function IconDiamond() {
  // Baseball diamond — the league home.
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden>
      <path d="M12 3l9 9-9 9-9-9 9-9z" />
    </svg>
  );
}

function IconCrosshair() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
      <circle cx={12} cy={12} r={7} />
      <line x1={12} y1={2} x2={12} y2={5} />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={2} y1={12} x2={5} y2={12} />
      <line x1={19} y1={12} x2={22} y2={12} />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h12v8a6 6 0 0 1-12 0V2z" />
      <path d="M6 5H3a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M18 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M19 3v16" />
    </svg>
  );
}

function IconTeams() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const LABELS: Record<string, { es: string; en: string }> = {
  liga: { es: "Liga", en: "League" },
  picks: { es: "Picks", en: "Picks" },
  equipos: { es: "Equipos", en: "Teams" },
  tabla: { es: "Tabla", en: "Board" },
  reglas: { es: "Reglas", en: "Rules" },
};

/** Extract the league slug from the pathname, or null when not inside a league. */
function leagueFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/ligas-invernales\/([^/]+)/);
  if (!m) return null;
  const slug = m[1];
  if (slug === "todas") return null;
  return slug in LEAGUE_THEMES ? slug : null;
}

export function LigasTabBar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const league = leagueFromPath(pathname);
  if (!league) return null;

  const base = `/ligas-invernales/${league}`;
  const label = (k: string) => (locale === "es" ? LABELS[k].es : LABELS[k].en);

  // Serie del Caribe has no standing roster (champions decided in-season), so
  // it omits the Teams tab.
  const showTeams = league !== "sdc";

  const tabs = [
    { key: "liga", href: base, icon: <IconDiamond />, isActive: (p: string) => p === base },
    { key: "picks", href: `${base}/picks`, icon: <IconCrosshair />, isActive: (p: string) => p.startsWith(`${base}/picks`) },
    ...(showTeams
      ? [{ key: "equipos", href: `${base}/equipos`, icon: <IconTeams />, isActive: (p: string) => p.startsWith(`${base}/equipos`) }]
      : []),
    { key: "tabla", href: `${base}/tabla`, icon: <IconTrophy />, isActive: (p: string) => p.startsWith(`${base}/tabla`) },
    { key: "reglas", href: `${base}/reglas`, icon: <IconBook />, isActive: (p: string) => p.startsWith(`${base}/reglas`) },
  ];

  return (
    <nav
      aria-label="League navigation"
      style={{
        ...ligaVars(league),
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        paddingBottom: "env(safe-area-inset-bottom)",
        touchAction: "manipulation",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      className="border-t border-ps-border bg-ps-bg"
    >
      <div className="mx-auto flex h-[56px] max-w-[480px] items-stretch">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative flex flex-1 flex-col items-center justify-center gap-px transition-colors transition-transform duration-150 active:scale-95",
                active ? "text-liga-deep dark:text-liga" : "text-ps-text-ter",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute inset-x-2 inset-y-1 rounded-xl transition-colors duration-150",
                  active ? "bg-liga/10" : "bg-transparent group-active:bg-liga/15",
                ].join(" ")}
                aria-hidden
              />
              <span className="relative group-active:translate-y-[1px] transition-transform duration-75">
                {tab.icon}
              </span>
              <span className="relative text-micro font-semibold uppercase tracking-wider leading-none">
                {label(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
