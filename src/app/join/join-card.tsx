"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JoinCardProps {
  token: string;
  competitionName: string;
  memberCount: number;
}

export function JoinCard({ token, competitionName, memberCount }: JoinCardProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to join");
        setIsJoining(false);
        return;
      }

      // Success — redirect to predictions
      router.push(`/predictions?competition=${data.competition_id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsJoining(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
      {/* Drag handle */}
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

      {/* Logo row */}
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706]"
          aria-hidden="true"
        >
          <span className="font-display text-[22px] leading-none tracking-wide text-ps-text">
            PS
          </span>
        </div>
        <div>
          <p className="text-base font-extrabold lowercase leading-tight tracking-tight text-ps-text">
            sports<span className="text-ps-amber">predict.</span>
          </p>
          <p className="text-[11.5px] leading-tight text-ps-text-sec">
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {/* Competition name */}
      <p className="mb-1 font-display text-2xl font-extrabold leading-tight text-ps-text">
        {competitionName}
      </p>

      {/* Confirmation copy */}
      <p className="mb-5 text-sm leading-relaxed text-ps-text-sec">
        You&apos;re in — ready to start calling it with the group?
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-ps-red bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleJoin}
          disabled={isJoining}
          className="flex flex-1 items-center justify-center rounded-xl bg-ps-text px-4 py-3.5 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: "44px" }}
        >
          {isJoining ? "Joining..." : "Yes, join"}
        </button>
        <button
          onClick={() => router.push("/predictions")}
          disabled={isJoining}
          className="flex flex-1 items-center justify-center rounded-xl border border-ps-border-strong bg-transparent px-4 py-3.5 text-sm font-semibold text-ps-text-sec transition-colors hover:bg-ps-chip disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: "44px" }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
