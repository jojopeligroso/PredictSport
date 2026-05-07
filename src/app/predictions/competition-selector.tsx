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

  if (competitions.length <= 1) return null;

  function handleChange(competitionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("competition", competitionId);
    router.push(`/predictions?${params.toString()}`);
  }

  return (
    <div className="mt-4">
      <label
        htmlFor="competition-select"
        className="block text-xs font-medium uppercase tracking-wider text-ps-text-sec"
      >
        Competition
      </label>
      <select
        id="competition-select"
        value={selectedId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1 rounded-xl border border-ps-border-strong bg-ps-surface px-3 py-2 text-sm font-medium text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
      >
        {competitions.map((comp) => (
          <option key={comp.id} value={comp.id}>
            {comp.name}
            {comp.status !== "active" ? ` (${comp.status})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
