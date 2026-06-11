"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface CountdownProps {
  lockTime: string;
  pickRevealAt?: string;
}

function getTimeRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, totalMs: diff };
}

function formatTimeParts(remaining: NonNullable<ReturnType<typeof getTimeRemaining>>): string {
  const parts: string[] = [];
  if (remaining.days > 0) parts.push(`${remaining.days}d`);
  if (remaining.hours > 0 || remaining.days > 0) parts.push(`${remaining.hours}h`);
  parts.push(`${remaining.minutes}m`);
  if (remaining.days === 0) parts.push(`${remaining.seconds}s`);
  return parts.join(" ");
}

export function Countdown({ lockTime, pickRevealAt }: CountdownProps) {
  const t = useT();

  const revealIso = pickRevealAt
    ? pickRevealAt
    : new Date(new Date(lockTime).getTime() + 5 * 60_000).toISOString();

  const [remaining, setRemaining] = useState(() => getTimeRemaining(lockTime));
  const [revealRemaining, setRevealRemaining] = useState(() =>
    getTimeRemaining(revealIso)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getTimeRemaining(lockTime);
      const rv = getTimeRemaining(revealIso);
      setRemaining(r);
      setRevealRemaining(rv);
      // Stop ticking once both lock and reveal have passed
      if (!r && !rv) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockTime, revealIso]);

  // Before lock: show "Locks in X"
  if (remaining) {
    const isUrgent = remaining.totalMs < 60 * 60 * 1000; // < 1 hour
    return (
      <span
        className={`text-xs font-mono font-medium ${
          isUrgent ? "text-ps-amber-deep" : "text-ps-text-ter"
        }`}
      >
        Locks in {formatTimeParts(remaining)}
      </span>
    );
  }

  // Between lock and reveal: show "Picks reveal in X"
  if (revealRemaining) {
    return (
      <span className="text-xs font-mono font-medium text-ps-text-ter">
        {t("rivals.picks_reveal_in", { time: formatTimeParts(revealRemaining) })}
      </span>
    );
  }

  // After reveal: show "Locked"
  return (
    <span className="text-xs font-medium text-ps-text-ter">
      Locked
    </span>
  );
}
