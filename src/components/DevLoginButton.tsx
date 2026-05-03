"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function DevLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("dev@predictsport.local");
  const router = useRouter();

  async function handleDevLogin() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: "devpassword123",
    });

    if (error) {
      // If user doesn't exist, sign up first
      if (error.message.includes("Invalid login")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: "devpassword123",
          options: {
            data: { full_name: "Dev User" },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }
        // Try login again after signup
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: "devpassword123",
        });
        if (retryError) {
          setError(retryError.message);
          setIsLoading(false);
          return;
        }
      } else {
        setError(error.message);
        setIsLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">
        DEV BYPASS
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        placeholder="Email"
      />
      <button
        onClick={handleDevLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
      >
        {isLoading ? "Signing in..." : "Dev Login (password bypass)"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
