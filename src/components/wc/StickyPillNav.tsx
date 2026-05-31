"use client";

import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { id: "points", label: "Points" },
  { id: "format", label: "Format" },
  { id: "picks", label: "Picks" },
  { id: "ties", label: "Ties" },
] as const;

export function StickyPillNav() {
  const [active, setActive] = useState("points");
  const scrollingRef = useRef(false);

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

    for (const { id } of SECTIONS) {
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
    setTimeout(() => {
      scrollingRef.current = false;
    }, 800);
  }

  return (
    <nav
      aria-label="Rules sections"
      className="sticky top-0 z-50 -mx-4 border-b border-ps-border bg-ps-bg/[0.96] backdrop-blur-sm"
    >
      <div className="flex gap-1.5 overflow-x-auto px-4 py-1.5 scrollbar-none">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold leading-none transition-colors ${
              active === id
                ? "bg-ps-amber text-ps-bg"
                : "text-ps-text-ter hover:text-ps-text-sec"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
