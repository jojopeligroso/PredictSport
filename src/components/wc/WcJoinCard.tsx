"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WcJoinCardProps {
  isAuthenticated: boolean;
  /** Competition ID for direct-join flow. If provided, renders a button that calls /api/join. */
  competitionId?: string;
  /** Earliest lock time ISO string for countdown display. */
  firstLockTime?: string | null;
  /** Extra className for the outer wrapper (e.g. pointer-events-auto, shadow-lg). */
  className?: string;
}

/**
 * Shared Join CTA card used on the /wc landing overlay and /wc/rules page.
 * Single source of truth — change once, reflects everywhere.
 *
 * Two join modes:
 * - Direct join (competitionId provided): button calls /api/join directly
 * - Link join (no competitionId): links to /wc/join-open or /login
 */
export function WcJoinCard({
  isAuthenticated,
  competitionId,
  firstLockTime,
  className,
}: WcJoinCardProps) {
  const router = useRouter();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  async function handleDirectJoin() {
    if (!isAuthenticated) {
      router.push("/login?next=/wc/join-open");
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      router.push("/wc/home?onboarding=true");
    } catch {
      setJoinError("Something went wrong. Try again.");
    } finally {
      setIsJoining(false);
    }
  }

  const joinHref = isAuthenticated ? "/wc/join-open" : "/login?next=/wc/join-open";
  const createHref = isAuthenticated ? "/wc/create" : "/login?next=/wc/create";

  return (
    <div
      className={[
        "rounded-2xl border border-ps-border bg-ps-surface px-6 py-6 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ps-text">
        Join the World Cup game
      </h2>
      <p className="mt-2 text-sm text-ps-text-sec">
        Free to play. Bragging rights on the line.
      </p>

      {firstLockTime && (
        <div className="mt-1.5">
          <LockCountdown lockTime={firstLockTime} />
        </div>
      )}

      {joinError && (
        <p role="alert" className="mt-2 text-sm text-ps-red">
          {joinError}
        </p>
      )}

      {competitionId ? (
        <button
          onClick={handleDirectJoin}
          disabled={isJoining}
          className="mt-4 w-full rounded-xl bg-ps-amber px-4 py-3.5 text-base font-semibold text-ps-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {isJoining ? "Joining..." : "Join the World Cup game"}
        </button>
      ) : (
        <Link
          href={joinHref}
          className="mt-4 inline-block w-full rounded-xl bg-ps-amber px-4 py-3.5 text-base font-semibold text-ps-bg transition-opacity hover:opacity-90 active:opacity-80"
        >
          Join the World Cup game
        </Link>
      )}

      <Link
        href={createHref}
        className="mt-3 inline-block text-xs font-medium text-ps-text-ter transition-colors hover:text-ps-text-sec"
      >
        or create your own competition
      </Link>
    </div>
  );
}

function LockCountdown({ lockTime }: { lockTime: string }) {
  const [display, setDisplay] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      const diff = new Date(lockTime).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(
        `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lockTime]);

  if (display === null) {
    return (
      <p className="text-xs text-ps-text-sec">
        Joins close 3 days after kickoff.
      </p>
    );
  }

  return (
    <p className="text-xs text-ps-text-sec">
      Picks lock in{" "}
      <span className="font-mono font-bold text-ps-text">{display}</span>
    </p>
  );
}
