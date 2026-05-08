"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Usage:
// import JoinCompetitionCard from "@/app/predictions/join-competition-card";
// <JoinCompetitionCard />

function parseToken(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("token");
    if (token) return token;
  } catch {
    // Not a URL — treat as raw token
  }
  return trimmed;
}

export default function JoinCompetitionCard() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const token = parseToken(value);

    if (!token) {
      setError("Please paste an invite link or code.");
      return;
    }

    router.push(`/join?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <p className="text-sm font-semibold text-ps-text">Join a Competition</p>
      <p className="mt-0.5 text-xs text-ps-text-ter">
        Paste an invite link or code
      </p>

      <form onSubmit={handleSubmit} className="mt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
            placeholder="Invite link or code"
            aria-label="Invite link or code"
            className="min-w-0 flex-1 rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text placeholder:text-ps-text-ter outline-none focus:border-ps-border-strong"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-ps-text px-4 py-2.5 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-80 active:opacity-70"
          >
            Join
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-ps-red" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
