"use client";

import { useState } from "react";
import { EntrantProfileHeader } from "./EntrantProfileHeader";
import { PicksByRound } from "./PicksByRound";
import { PickSearchFilter } from "./PickSearchFilter";
import { TagHistory } from "./TagHistory";
import type { EntrantProfileData } from "./fetchEntrantProfileData";

interface EntrantProfileClientProps {
  data: EntrantProfileData;
  from?: string;
}

export function EntrantProfileClient({ data, from }: EntrantProfileClientProps) {
  const [searchText, setSearchText] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <EntrantProfileHeader
        displayName={data.displayName}
        rank={data.rank}
        totalPoints={data.totalPoints}
        accuracy={data.accuracy}
        formatStatus={data.formatStatus}
        formStreak={data.formStreak}
        activeTags={data.activeTags}
        isSelf={data.isSelf}
        from={from}
      />

      {/* Picks section */}
      <section>
        <PickSearchFilter value={searchText} onChange={setSearchText} />
        <PicksByRound picks={data.picks} searchText={searchText} />
      </section>

      {/* Active tags only */}
      {data.activeTags.length > 0 && (
        <TagHistory tags={data.activeTags} displayName={data.displayName} />
      )}

      {/* Group membership */}
      {data.group && (
        <section>
          <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-wider text-ps-text-ter">
            Group
          </h2>
          <div className="rounded-xl border border-ps-border bg-ps-surface">
            <div className="px-3 py-2 text-sm font-bold text-ps-text">
              {data.group.groupName}
            </div>
            <div className="divide-y divide-ps-border">
              {data.group.members.map((m) => (
                <div
                  key={m.userId}
                  className={`flex items-center px-3 py-2 ${
                    m.isTarget ? "bg-ps-amber/5" : ""
                  }`}
                >
                  <span
                    className={`flex-1 truncate text-sm ${
                      m.isTarget ? "font-bold text-ps-text" : "text-ps-text"
                    }`}
                  >
                    {m.displayName}
                    {m.isSelf && (
                      <span className="ml-1.5 rounded bg-ps-amber/20 px-1 py-0.5 text-micro font-bold text-ps-amber-deep">
                        You
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-bold text-ps-text">
                    {m.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
