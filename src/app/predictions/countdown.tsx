"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  lockTime: string;
}

function getTimeRemaining(lockTime: string) {
  const diff = new Date(lockTime).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, totalMs: diff };
}

export function Countdown({ lockTime }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(lockTime));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getTimeRemaining(lockTime);
      setRemaining(r);
      if (!r) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockTime]);

  if (!remaining) {
    return (
      <span className="text-xs font-medium text-ps-text-ter">
        Locked
      </span>
    );
  }

  const isUrgent = remaining.totalMs < 60 * 60 * 1000; // < 1 hour

  const parts: string[] = [];
  if (remaining.days > 0) parts.push(`${remaining.days}d`);
  if (remaining.hours > 0 || remaining.days > 0)
    parts.push(`${remaining.hours}h`);
  parts.push(`${remaining.minutes}m`);
  if (remaining.days === 0) parts.push(`${remaining.seconds}s`);

  return (
    <span
      className={`text-xs font-mono font-medium ${
        isUrgent ? "text-ps-amber-deep" : "text-ps-text-ter"
      }`}
    >
      Locks in {parts.join(" ")}
    </span>
  );
}
