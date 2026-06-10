"use client";

/**
 * JoinWithCode — client form for the /wc/join invite-code entry page.
 *
 * Captures an invite token from the user and redirects to /join?token=…
 * which handles the actual enrollment logic (token validation, member insert,
 * redirect to competition).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export function JoinWithCode() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t("join.invite_empty_error"));
      return;
    }
    router.push(`/join?token=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <div>
        <label htmlFor="invite-code" className="sr-only">
          {t("join.invite_placeholder")}
        </label>
        <input
          id="invite-code"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("join.invite_placeholder")}
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          className="w-full rounded-xl border border-ps-border bg-ps-surface px-4 py-3 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none"
          aria-describedby={error ? "invite-code-error" : undefined}
        />
        {error && (
          <p
            id="invite-code-error"
            role="alert"
            className="mt-2 text-xs text-ps-red"
          >
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90 active:opacity-80"
      >
        {t("join.invite_button")}
      </button>

      <p className="text-center text-xs text-ps-text-sec">
        <Link
          href="/wc/create"
          className="font-semibold text-ps-amber-deep underline-offset-2 hover:underline"
        >
          {t("join.no_code_link")}
        </Link>
      </p>
    </form>
  );
}
