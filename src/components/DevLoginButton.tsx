"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function DevLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("eoinuamaoileoin@gmail.com");
  const router = useRouter();

  async function handleDevLogin() {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.access_token) {
        setError(data.error ?? "Login failed");
        setIsLoading(false);
        return;
      }

      // Set the session via the Supabase client so cookies are written properly
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      router.push("/wc/home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setIsLoading(false);
    }
  }

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mt-4 space-y-2.5 border-t border-ps-border pt-4">
      <p className="text-center font-mono text-xs font-semibold tracking-wider text-ps-amber">
        DEV BYPASS
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDevLogin();
        }}
        className="w-full rounded-xl border border-ps-border bg-ps-surface p-3 text-sm text-ps-text placeholder:text-ps-text-ter transition-colors focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/50"
        placeholder="Any existing user email"
      />
      <button
        onClick={handleDevLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-xl border border-ps-amber bg-ps-amber/10 px-4 py-3 text-sm font-semibold text-ps-amber transition-all duration-150 hover:bg-ps-amber/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight: "44px" }}
      >
        {isLoading ? "Signing in..." : "Dev Login (any email)"}
      </button>
      {error && (
        <p className="text-center text-sm text-ps-red">{error}</p>
      )}
    </div>
  );
}
