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
        className="text-sm font-medium text-ps-text-sec"
      >
        Competition
      </label>
      <select
        id="competition-select"
        value={selectedId ?? ""}
        onChange={handleChange}
        className="rounded-xl border border-ps-border-strong bg-ps-surface px-3 py-2 text-sm text-ps-text shadow-sm transition-colors focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-[rgba(245,158,11,0.2)]"
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
