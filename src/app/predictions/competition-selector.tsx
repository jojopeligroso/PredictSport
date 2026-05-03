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
        className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
      >
        Competition
      </label>
      <select
        id="competition-select"
        value={selectedId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
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
