"use client";

import { useCallback, useEffect, useState } from "react";
import { TagCard } from "@/components/wc/TagCard";
import type { MemberTag } from "@/types/database";
import type { TagDefinition } from "@/lib/reputation/tag-catalogue";

interface TagSectionProps {
  competitionId: string;
  isMember: boolean;
}

interface TagResponse {
  tag: MemberTag | null;
  definition?: {
    name: string;
    layer1: string;
    layer2: string;
    factCard: TagDefinition["factCard"];
    visual: TagDefinition["visual"];
    rejectable: boolean;
    category: string;
  };
}

/**
 * Dashboard section that shows the user's current reputation tag.
 *
 * Gated behind NEXT_PUBLIC_FEATURE_TAGS env var.
 * Dismissable per tag via localStorage.
 */
export function TagSection({ competitionId, isMember }: TagSectionProps) {
  const [tagData, setTagData] = useState<TagResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Feature flag check
  const featureEnabled =
    process.env.NEXT_PUBLIC_FEATURE_TAGS === "true";

  useEffect(() => {
    if (!featureEnabled || !isMember) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch(`/api/tournament/my-tag?competitionId=${competitionId}`)
      .then((res) => res.json())
      .then((data: TagResponse) => {
        if (cancelled) return;
        setTagData(data);

        // Check if this tag was already dismissed
        if (data.tag) {
          try {
            const key = `tag-dismissed-${data.tag.id}`;
            if (localStorage.getItem(key) === "1") {
              setDismissed(true);
            }
          } catch {
            // localStorage may be unavailable
          }
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId, isMember, featureEnabled]);

  const handleAction = useCallback(
    async (action: "accept" | "reject") => {
      if (!tagData?.tag || acting) return;
      setActing(true);

      try {
        const res = await fetch("/api/tournament/tag-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId: tagData.tag.id, action }),
        });

        if (res.ok) {
          // Dismiss the card after action
          try {
            localStorage.setItem(`tag-dismissed-${tagData.tag.id}`, "1");
          } catch {
            // ignore
          }
          setDismissed(true);
        }
      } catch {
        // Silently fail — user can try again
      } finally {
        setActing(false);
      }
    },
    [tagData, acting],
  );

  if (!featureEnabled || !isMember || loading || !tagData?.tag || !tagData.definition || dismissed) {
    return null;
  }

  // Build a TagDefinition-compatible object from the API response
  const tagDef: TagDefinition = {
    name: tagData.definition.name,
    layer1: tagData.definition.layer1,
    layer2: tagData.definition.layer2,
    layer3: "", // Not needed for rendering
    factCard: tagData.definition.factCard,
    visual: tagData.definition.visual,
    rejectable: tagData.definition.rejectable,
    category: tagData.definition.category as TagDefinition["category"],
    // These are not needed for rendering but required by the type:
    priorityTier: 3,
    metric: "",
    qualifies: () => false,
    zScore: () => 0,
    announced: false,
  };

  return (
    <section className="mt-5">
      <TagCard
        tag={tagData.tag}
        tagDefinition={tagDef}
        displayName=""
        isOwnTag
        onAccept={() => handleAction("accept")}
        onReject={() => handleAction("reject")}
      />
    </section>
  );
}
