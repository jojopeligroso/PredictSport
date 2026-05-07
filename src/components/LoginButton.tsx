"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // If successful, the browser will redirect to Google OAuth
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#111] px-4 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
        {isLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      {error && (
        <p className="text-center text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
