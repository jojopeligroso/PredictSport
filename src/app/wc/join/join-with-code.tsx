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

export function JoinWithCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }
    router.push(`/join?token=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <div>
        <label htmlFor="invite-code" className="sr-only">
          Invite code
        </label>
        <input
          id="invite-code"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Invite code"
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
        Join
      </button>

      <p className="text-center text-xs text-ps-text-sec">
        Don&apos;t have a code?{" "}
        <Link
          href="/wc/create"
          className="font-semibold text-ps-amber-deep underline-offset-2 hover:underline"
        >
          Create your own →
        </Link>
      </p>
    </form>
  );
}
