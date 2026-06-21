"use client";

import { useEffect, useRef, useState } from "react";
import { useT, useLocale, type Locale } from "@/lib/i18n";

const SECTION_KEYS = [
  { id: "points", key: "rules.nav_points" },
  { id: "format", key: "rules.nav_format" },
  { id: "picks", key: "rules.nav_picks" },
  { id: "faq", key: "rules.nav_faq" },
] as const;

function flagUrl(code: string) {
  return `https://flagcdn.com/${code}.svg`;
}

export function StickyPillNav() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [active, setActive] = useState("points");
  const scrollingRef = useRef(false);

  const nextLocale: Locale = locale === "es" ? "en" : "es";
  // Show the TARGET flag: MX when in EN (tap → Spanish), CA when in ES (tap → English)
  const targetFlag = locale === "es" ? "ca" : "mx";
  const toggleLabel =
    locale === "es" ? t("common.switch_to_en") : t("common.switch_to_es");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-56px 0px -60% 0px", threshold: 0 },
    );

    for (const { id } of SECTION_KEYS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    scrollingRef.current = true;
    setActive(id);
    const top = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: "smooth" });
    if (id === "format") {
      window.dispatchEvent(new Event("format-dots-flash"));
    }
    setTimeout(() => {
      scrollingRef.current = false;
    }, 800);
  }

  // Pill flag dimensions — FIFA poster pill shape
  const w = 20;
  const h = Math.round((w * 3) / 4);
  const r = Math.round(w * 0.35);
  const clip = `path('M 0 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} Z')`;

  return (
    <nav
      aria-label="Rules sections"
      className="sticky top-0 z-50 -mx-4 border-b border-ps-border bg-ps-bg/[0.96] backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-1.5 scrollbar-none">
        {SECTION_KEYS.map(({ id, key }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-caption font-semibold leading-none transition-colors ${
              active === id
                ? "bg-ps-amber text-ps-bg"
                : "text-ps-text-ter hover:text-ps-text-sec"
            }`}
          >
            {t(key)}
          </button>
        ))}

        {/* Divider + language flag toggle */}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-ps-border" aria-hidden />
        <button
          type="button"
          onClick={() => setLocale(nextLocale)}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="flex shrink-0 items-center rounded-full px-2 py-1.5 transition-opacity hover:opacity-80 active:scale-95"
        >
          <span
            className="relative inline-block shrink-0 bg-white"
            style={{
              width: w,
              height: h,
              clipPath: clip,
              WebkitClipPath: clip,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
            }}
          >
            <img
              src={flagUrl(targetFlag)}
              alt=""
              width={w}
              height={h}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(0.88) brightness(0.96)" }}
            />
          </span>
        </button>
      </div>
    </nav>
  );
}
