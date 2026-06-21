"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/display-name";
import { useT } from "@/lib/i18n";

interface DisplayNameModalProps {
  suggestedName: string;
}

export function DisplayNameModal({ suggestedName }: DisplayNameModalProps) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
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

    const validationError = validateDisplayName(trimmed);
    if (validationError) {
      setError(t(validationError));
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
        setError(data?.error || t('display_name.error_generic'));
        setSubmitting(false);
        return;
      }

      // If a `next` param exists (e.g. from join-open redirect), navigate there.
      // Otherwise re-render server components so the guard sees the updated name.
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        router.push(next);
      } else {
        router.refresh();
      }
    } catch {
      setError(t('display_name.error_network'));
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

        <h2 className="text-section-title font-extrabold text-ps-text">
          {t('display_name.heading')}
        </h2>
        <p className="mt-1 text-sm text-ps-text-sec">
          {t('display_name.subtitle')}
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
            placeholder={t('display_name.placeholder')}
            maxLength={DISPLAY_NAME_MAX}
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
            {submitting ? t('display_name.submitting') : t('display_name.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
