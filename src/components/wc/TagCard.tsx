"use client";

import { useState } from "react";
import type { MemberTag } from "@/types/database";
import type { TagDefinition } from "@/lib/reputation/tag-catalogue";

interface TagCardProps {
  tag: MemberTag;
  tagDefinition: TagDefinition;
  displayName: string;
  isOwnTag: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  compact?: boolean;
}

/**
 * Interpolate template strings like "You did {pct}% of picks"
 * with values from the tag's stats object.
 */
function interpolate(
  template: string,
  stats: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = stats[key];
    return val != null ? String(val) : `{${key}}`;
  });
}

function FullTagCard({
  tag,
  tagDefinition,
  isOwnTag,
  onAccept,
  onReject,
}: Omit<TagCardProps, "compact" | "displayName">) {
  const isGhost = tag.status === "suppressed" || tag.tag_category === "engagement_pressure" && tag.tag_name === "Ghost";
  const isEngagementPressure = tag.tag_category === "engagement_pressure";
  const showCTAs =
    isOwnTag &&
    tag.status === "active" &&
    !tag.accepted_at &&
    !isEngagementPressure &&
    tagDefinition.rejectable;

  const stats = (tag.stats ?? {}) as Record<string, unknown>;
  const subtitle = interpolate(tagDefinition.layer2, stats);
  const statLine = interpolate(tagDefinition.factCard.statTemplate, stats);
  const contextLine = interpolate(tagDefinition.factCard.contextTemplate, stats);

  return (
    <div
      className="rounded-r-lg px-3 py-2.5"
      style={{
        borderLeft: `3px solid ${tagDefinition.visual.borderColor}`,
        backgroundColor: "var(--ps-amber-soft)",
        opacity: isGhost || tag.status === "suppressed" ? 0.6 : 1,
      }}
    >
      {/* Tag name */}
      <p
        className="font-display text-xs font-extrabold uppercase text-ps-text"
        style={{ letterSpacing: "0.06em" }}
      >
        {tagDefinition.layer1}
      </p>

      {/* Subtitle (Layer 2) */}
      <p className="mt-0.5 font-serif text-sm italic text-ps-text">
        {subtitle}
      </p>

      {/* Stat line */}
      <p className="mt-1 font-mono text-sm text-ps-amber">
        {statLine}
      </p>

      {/* Context line */}
      <p className="mt-0.5 text-xs text-ps-text-sec">
        {contextLine}
      </p>

      {/* CTAs */}
      {showCTAs && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-ps-amber px-3.5 py-1.5 text-xs font-bold text-ps-text transition-opacity hover:opacity-90"
          >
            Wear it
          </button>
          <button
            type="button"
            onClick={onReject}
            className="rounded-full border border-ps-border px-3.5 py-1.5 text-xs font-semibold text-ps-text-sec transition-colors hover:border-ps-text-ter"
          >
            Not for me
          </button>
        </div>
      )}
    </div>
  );
}

function CompactTagBadge({
  tag,
  tagDefinition,
  onClick,
}: {
  tag: MemberTag;
  tagDefinition: TagDefinition;
  onClick?: () => void;
}) {
  const isGhost = tag.tag_name === "Ghost";
  const isGold = tagDefinition.visual.gold;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full px-1.5 py-0.5 transition-opacity hover:opacity-80"
      style={{
        backgroundColor: isGold ? "#f59e0b" : tagDefinition.visual.borderColor,
        opacity: isGhost ? 0.6 : 1,
      }}
    >
      <span
        className="font-display text-[10px] font-extrabold uppercase text-white"
        style={{ letterSpacing: "0.05em" }}
      >
        {tagDefinition.layer1}
      </span>
    </button>
  );
}

export function TagCard({
  tag,
  tagDefinition,
  displayName,
  isOwnTag,
  onAccept,
  onReject,
  compact,
}: TagCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return (
      <>
        <CompactTagBadge
          tag={tag}
          tagDefinition={tagDefinition}
          onClick={() => setExpanded(!expanded)}
        />
        {expanded && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-ps-border bg-ps-surface p-1 shadow-lg">
            <FullTagCard
              tag={tag}
              tagDefinition={tagDefinition}
              isOwnTag={isOwnTag}
              onAccept={onAccept}
              onReject={onReject}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <FullTagCard
      tag={tag}
      tagDefinition={tagDefinition}
      isOwnTag={isOwnTag}
      onAccept={onAccept}
      onReject={onReject}
    />
  );
}
