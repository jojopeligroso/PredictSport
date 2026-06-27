"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Shared reputation-tag badge used across every leaderboard surface:
 * the overall standings, the format/group views, and the Rival Predictions
 * tab. Renders a compact pill beside a user's name; tapping expands a popover
 * with the tag's fact card.
 *
 * A user can hold both a behavioural tag (a "title" held until someone else
 * earns it) and a fresh event-driven tag (which lives on a short timer). When
 * both are present we show both pills — event-driven first, since it's the
 * timely one. See `/api/tournament/competition-tags` for the lifecycle rules.
 */
export interface LeaderboardTag {
  tagName: string;
  tagCategory: string;
  status: string;
  stats: Record<string, unknown>;
  definition: {
    layer1: string;
    layer2: string;
    factCard: { fact: string; statTemplate: string; contextTemplate: string };
    visual: { borderColor: string; gold?: boolean; opacity?: number };
  };
}

/**
 * Render every tag a user currently holds as a row of pills.
 * Event-driven tags sort first (they're the timely, fleeting ones).
 */
export function TagPills({
  tags,
  displayName,
}: {
  tags: LeaderboardTag[] | undefined;
  displayName: string;
}) {
  if (!tags || tags.length === 0) return null;

  const ordered = [...tags].sort((a, b) => {
    const aEvent = a.tagCategory === "event_driven" ? 0 : 1;
    const bEvent = b.tagCategory === "event_driven" ? 0 : 1;
    return aEvent - bEvent;
  });

  return (
    <>
      {ordered.map((tag) => (
        <LeaderboardTagBadge
          key={`${tag.tagCategory}:${tag.tagName}`}
          tag={tag}
          displayName={displayName}
        />
      ))}
    </>
  );
}

export function LeaderboardTagBadge({
  tag,
  displayName,
}: {
  tag: LeaderboardTag;
  displayName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isGhost = tag.tagName === "Ghost";
  const isGold = tag.definition.visual.gold;

  // Click-outside dismiss
  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [expanded]);

  const interpolate = (tpl: string) =>
    tpl.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === "name") return displayName;
      const val = tag.stats[key];
      return val != null ? String(val) : `{${key}}`;
    });

  return (
    <span className="shrink-0 relative" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center justify-center rounded-full px-1.5 min-h-[44px] min-w-[44px] transition-opacity hover:opacity-80"
        style={{
          backgroundColor: isGold ? "#f59e0b" : tag.definition.visual.borderColor,
          opacity: isGhost ? 0.6 : 1,
        }}
        aria-expanded={expanded}
      >
        <span
          className="font-display text-[10px] font-extrabold uppercase leading-none text-white"
          style={{ letterSpacing: "0.05em" }}
        >
          {tag.definition.layer1}
        </span>
      </button>

      {expanded && (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-ps-border bg-ps-surface shadow-lg"
          style={{ borderLeft: `3px solid ${tag.definition.visual.borderColor}` }}
        >
          <div className="px-3 py-2.5">
            <p
              className="font-display text-xs font-extrabold uppercase text-ps-text"
              style={{ letterSpacing: "0.06em" }}
            >
              {tag.definition.layer1}
            </p>
            <p className="mt-0.5 font-serif text-xs italic text-ps-text">
              {interpolate(tag.definition.layer2)}
            </p>
            <p className="mt-1 font-mono text-xs text-ps-amber">
              {interpolate(tag.definition.factCard.statTemplate)}
            </p>
            <p className="mt-0.5 text-[11px] text-ps-text-ter">
              {interpolate(tag.definition.factCard.contextTemplate)}
            </p>
            <div className="mt-1.5 border-t border-ps-border/40 pt-1.5">
              <p className="text-[11px] leading-relaxed text-ps-text-sec">
                {tag.definition.factCard.fact}
              </p>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
