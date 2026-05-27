"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DisplayNameModalProps {
  suggestedName: string;
}

export function DisplayNameModal({ suggestedName }: DisplayNameModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Auto-focus and select all text so the user can easily replace
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();

    if (trimmed.length < 1) {
      setError("You need a name for the leaderboard.");
      return;
    }
    if (trimmed.length > 50) {
      setError("50 characters max.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      // Re-render server components so the guard sees the updated display_name
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-ps-border bg-ps-surface p-6 shadow-lg">
        {/* Icon */}
        <div
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-ps-amber-soft"
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ps-amber-deep"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h2 className="text-lg font-extrabold text-ps-text">
          What should the leaderboard call you?
        </h2>
        <p className="mt-1 text-sm text-ps-text-sec">
          This is how you&apos;ll appear to everyone. You can change it later in
          your profile.
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label htmlFor="display-name" className="sr-only">
            Display name
          </label>
          <input
            ref={inputRef}
            id="display-name"
            type="text"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g. Gerry Ramos"
            maxLength={50}
            autoComplete="off"
            className={[
              "w-full rounded-lg border bg-ps-bg px-3 py-2.5 text-sm text-ps-text",
              "placeholder:text-ps-text-ter",
              "focus:outline-none focus:ring-2 focus:ring-ps-amber focus:ring-offset-1",
              error ? "border-ps-red" : "border-ps-border",
            ].join(" ")}
          />

          {error && (
            <p className="mt-1.5 text-xs font-medium text-ps-red">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || name.trim().length === 0}
            className={[
              "mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
              "bg-ps-amber text-ps-bg",
              "hover:bg-ps-amber-deep",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {submitting ? "Saving\u2026" : "Lock it in"}
          </button>
        </form>
      </div>
    </div>
  );
}
