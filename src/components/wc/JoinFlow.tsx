"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JoinFlowProps {
  competitionId: string;
  destination: string;
  currentDisplayName: string;
  maxEntrants: number | null;
  currentCount: number;
}

export function JoinFlow({
  competitionId,
  destination,
  currentDisplayName,
  maxEntrants,
  currentCount,
}: JoinFlowProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = displayName.trim().length >= 1 && displayName.trim().length <= 50;

  const handleJoin = async () => {
    if (!nameValid) return;
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Save display name
      const nameRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });

      if (!nameRes.ok) {
        const data = await nameRes.json();
        setError(data.error || "Failed to save display name");
        return;
      }

      // Step 2: Enroll in competition
      const enrollRes = await fetch("/api/tournament/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competition_id: competitionId }),
      });

      if (!enrollRes.ok) {
        const data = await enrollRes.json();
        setError(data.error || "Failed to join competition");
        return;
      }

      router.push(destination);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-12 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">
        Join the Game
      </h1>

      {maxEntrants && (
        <p className="mt-2 font-mono text-xs text-ps-text-ter">
          {currentCount} / {maxEntrants} entrants
        </p>
      )}

      <div className="mt-6 rounded-xl border border-ps-border bg-ps-surface p-5">
        <label htmlFor="display-name" className="block">
          <span className="text-sm font-semibold text-ps-text">
            Your display name
          </span>
          <p className="mt-1 text-xs text-ps-text-sec">
            This is how you'll show up to the lads on the leaderboard.
            Use the name they'll know you by.
          </p>
        </label>

        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className="mt-3 block w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text outline-none focus:border-ps-amber"
          placeholder="e.g. Malo"
        />

        {displayName.trim().length > 50 && (
          <p className="mt-1.5 text-xs font-medium text-ps-red">
            50 characters max
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm font-medium text-ps-red">{error}</p>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={submitting || !nameValid}
          className="mt-5 w-full rounded-lg bg-ps-amber px-4 py-2.5 text-sm font-bold text-[#1a1208] transition-opacity disabled:opacity-50"
        >
          {submitting ? "Joining..." : "Join Competition"}
        </button>
      </div>
    </div>
  );
}
