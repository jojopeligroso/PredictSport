"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const token = parseToken(value);

    if (!token) {
      setError(t("join.paste_invite_error"));
      return;
    }

    router.push(`/join?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <p className="text-sm font-semibold text-ps-text">{t("join.join_competition")}</p>
      <p className="mt-0.5 text-xs text-ps-text-ter">
        {t("join.paste_invite")}
      </p>

      <form onSubmit={handleSubmit} className="mt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
            placeholder={t("join.paste_invite_placeholder")}
            aria-label={t("join.paste_invite_placeholder")}
            className="min-w-0 flex-1 rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text placeholder:text-ps-text-ter outline-none focus:border-ps-border-strong"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-ps-text px-4 py-2.5 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-80 active:opacity-70"
          >
            {t("join.invite_button")}
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
