"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface CompetitionOption {
  id: string;
  name: string;
}

export function CompetitionSelector({
  competitions,
  selectedId,
}: {
  competitions: CompetitionOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("competition", e.target.value);
      router.push(`/leaderboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  if (competitions.length <= 1) return null;

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="competition-select"
        className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
      >
        Competition
      </label>
      <select
        id="competition-select"
        value={selectedId ?? ""}
        onChange={handleChange}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
      >
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
