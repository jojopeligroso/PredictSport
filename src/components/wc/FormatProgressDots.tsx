"use client";

import { useEffect, useRef, useState } from "react";

const SUB_SECTIONS = [
  { id: "format-groups", label: "Group Stage" },
  { id: "format-knockouts", label: "Knockout Rounds" },
  { id: "format-final", label: "Final" },
  { id: "format-narrowing", label: "How it Narrows" },
] as const;

export function FormatProgressDots() {
  const [visible, setVisible] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [activeSub, setActiveSub] = useState("format-groups");
  const scrollingRef = useRef(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashTooltips() {
    setShowTooltips(true);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setShowTooltips(false), 1300);
  }

  // Show/hide dots based on Format section visibility
  useEffect(() => {
    const formatEl = document.getElementById("format");
    if (!formatEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            flashTooltips();
          } else {
            setVisible(false);
            setShowTooltips(false);
          }
        }
      },
      { rootMargin: "-56px 0px -10% 0px", threshold: 0 },
    );

    observer.observe(formatEl);
    return () => observer.disconnect();
  }, []);

  // Listen for Format pill click to re-flash tooltips
  useEffect(() => {
    function onFlash() {
      flashTooltips();
    }
    window.addEventListener("format-dots-flash", onFlash);
    return () => {
      window.removeEventListener("format-dots-flash", onFlash);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  // Track active sub-section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSub(entry.target.id);
          }
        }
      },
      { rootMargin: "-56px 0px -55% 0px", threshold: 0 },
    );

    for (const { id } of SUB_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    scrollingRef.current = true;
    setActiveSub(id);
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: "smooth" });
    setTimeout(() => {
      scrollingRef.current = false;
    }, 800);
  }

  return (
    <nav
      aria-label="Format sub-sections"
      aria-hidden={!visible}
      className={`fixed top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 transition-opacity duration-150 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ right: "max(6px, calc(50vw - 240px))" }}
    >
      {SUB_SECTIONS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          aria-label={label}
          tabIndex={visible ? 0 : -1}
          title={label}
          className={`group relative h-[7px] w-[7px] rounded-full border-0 p-0 transition-all duration-150 ${
            activeSub === id
              ? "scale-[1.3] bg-ps-amber"
              : "bg-ps-text-ter/40 hover:bg-ps-text-ter/70"
          }`}
        >
          <span className={`pointer-events-none absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-ps-border bg-ps-surface px-2 py-1 text-[10px] font-semibold text-ps-text shadow-sm transition-opacity duration-150 ${showTooltips && activeSub === id ? "opacity-100" : "opacity-0"}`}>
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}
