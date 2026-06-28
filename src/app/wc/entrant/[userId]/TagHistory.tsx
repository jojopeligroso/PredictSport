"use client";

import type { EntrantTagRow } from "./fetchEntrantProfileData";

interface TagHistoryProps {
  tags: EntrantTagRow[];
  displayName: string;
}

export function TagHistory({ tags, displayName }: TagHistoryProps) {
  const interpolate = (tpl: string, stats: Record<string, unknown>) =>
    tpl.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === "name") return displayName;
      const val = stats[key];
      return val != null ? String(val) : `{${key}}`;
    });

  return (
    <section>
      <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-wider text-ps-text-ter">
        Tag History
      </h2>
      <div className="rounded-xl border border-ps-border bg-ps-surface divide-y divide-ps-border">
        {tags.map((tag) => (
          <div key={tag.id} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              {/* Tag pill */}
              {tag.definition && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold uppercase leading-none text-white ${
                    tag.status === "expired" ? "opacity-50" : ""
                  } ${tag.status === "rejected" ? "line-through opacity-50" : ""}`}
                  style={{
                    backgroundColor:
                      tag.definition.visual.gold
                        ? "#f59e0b"
                        : tag.definition.visual.borderColor,
                    letterSpacing: "0.05em",
                  }}
                >
                  {tag.definition.layer1}
                </span>
              )}
              {!tag.definition && (
                <span className="text-xs font-bold text-ps-text-sec">
                  {tag.tagName}
                </span>
              )}

              {/* Status badge */}
              <span
                className={`text-micro font-semibold ${
                  tag.status === "active"
                    ? "text-ps-green"
                    : tag.status === "expired"
                      ? "text-ps-text-ter"
                      : "text-ps-red"
                }`}
              >
                {tag.status}
              </span>
            </div>

            {/* Context */}
            <div className="mt-0.5 text-xs text-ps-text-sec">
              {tag.definition && (
                <span className="font-serif italic">
                  {interpolate(tag.definition.layer2, tag.stats)}
                </span>
              )}
              {(tag.roundName || tag.eventName) && (
                <span className="ml-1 font-mono text-ps-text-ter">
                  {tag.roundName}
                  {tag.eventName && ` \u00B7 ${tag.eventName}`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
