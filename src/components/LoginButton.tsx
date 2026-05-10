"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LoginButtonProps {
  redirectTo?: string;
}

export function LoginButton({ redirectTo }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

  const callbackUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(redirectTo || "/")}`;

  async function handleGoogleLogin() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // If successful, the browser will redirect to Google OAuth
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setIsSendingMagicLink(true);
    setError(null);
    setMagicLinkSent(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }

    setIsSendingMagicLink(false);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-ps-text px-4 py-3.5 text-sm font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        style={{ minHeight: "44px" }}
      >
        {/* Google G mark — white version */}
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            fill="#fff"
            d="M24 9.5c3.3 0 6.2 1.1 8.5 3.4l6.4-6.4C34.9 2.7 29.8.5 24 .5 14.6.5 6.6 5.7 2.5 13.4l7.5 5.8C12 13.5 17.4 9.5 24 9.5z"
          />
          <path
            fill="#fff"
            d="M46.5 24c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7C43.8 37.2 46.5 31 46.5 24z"
          />
          <path
            fill="#fff"
            d="M10 28.8C9.4 27.1 9 25.1 9 24s.4-3.1 1-4.8l-7.5-5.8C.9 16.4 0 20.1 0 24s.9 7.6 2.5 10.6L10 28.8z"
          />
          <path
            fill="#fff"
            d="M24 47.5c6 0 11-2 14.7-5.3l-7.4-5.7c-2 1.4-4.6 2.2-7.3 2.2-6.6 0-12-4-14-9.7l-7.5 5.8C6.6 42.3 14.6 47.5 24 47.5z"
          />
        </svg>
        {isLoading ? "Redirecting..." : "Continue with Google"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-ps-border" />
        <span className="text-xs text-ps-text-ter">or</span>
        <div className="h-px flex-1 bg-ps-border" />
      </div>

      {/* Magic link form */}
      <div className="space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleMagicLink();
          }}
          placeholder="Email address"
          className="w-full rounded-xl border border-ps-border bg-ps-surface p-3 text-sm text-ps-text placeholder:text-ps-text-ter transition-colors focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/50"
          disabled={isSendingMagicLink}
        />
        <button
          onClick={handleMagicLink}
          disabled={isSendingMagicLink}
          className="flex w-full items-center justify-center rounded-xl border border-ps-border bg-transparent px-4 py-3 text-sm font-medium text-ps-text transition-all duration-150 hover:bg-ps-surface active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          style={{ minHeight: "44px" }}
        >
          {isSendingMagicLink ? "Sending..." : "Send magic link"}
        </button>
      </div>

      {/* Success message */}
      {magicLinkSent && (
        <p className="text-center text-sm text-ps-green">
          Check your email for a login link
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-center text-sm text-ps-red">{error}</p>
      )}
    </div>
  );
}
