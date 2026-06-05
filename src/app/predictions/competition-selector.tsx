"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Competition } from "@/types/database";

interface CompetitionSelectorProps {
  competitions: Competition[];
  selectedId: string | null;
}

export function CompetitionSelector({
  competitions,
  selectedId,
}: CompetitionSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(competitionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("competition", competitionId);
    router.push(`/predictions?${params.toString()}`);
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ps-text-sec">
        Competition
      </p>
      <div
        className="ps-scroll flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Competition selector"
      >
        {competitions.map((comp) => {
          const isActive = comp.id === selectedId;
          const label =
            comp.status !== "active"
              ? `${comp.name} (${comp.status})`
              : comp.name;

          return (
            <button
              key={comp.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelect(comp.id)}
              className={[
                "flex-shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1",
                isActive
                  ? "border-ps-amber bg-ps-amber-soft text-ps-amber-deep"
                  : "border-transparent bg-ps-chip text-ps-text-sec hover:text-ps-text",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
