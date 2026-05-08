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
    <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)]">
      {/* Drag handle */}
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

      {/* Logo row */}
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706]"
          aria-hidden="true"
        >
          <span className="font-display text-[22px] leading-none tracking-wide text-[#1a1208]">
            PS
          </span>
        </div>
        <div>
          <p className="text-base font-bold leading-tight text-ps-text">
            PredictSport
          </p>
          <p className="text-[11.5px] leading-tight text-ps-text-sec">
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {/* Competition name */}
      <p className="mb-1 text-lg font-bold text-ps-text">{competitionName}</p>
      <p className="mb-5 text-sm text-ps-text-sec">
        You&apos;ve been invited to join this competition.
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-ps-red bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      {/* Join CTA */}
      <button
        onClick={handleJoin}
        disabled={isJoining}
        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-3.5 text-sm font-extrabold text-[#1a1208] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight: "44px" }}
      >
        {isJoining ? "Joining..." : `Join ${competitionName}`}
      </button>

      {/* Caption */}
      <p className="mt-2.5 text-center text-[11px] text-ps-text-ter">
        You&apos;ll be added as a participant.
      </p>
    </div>
  );
}
