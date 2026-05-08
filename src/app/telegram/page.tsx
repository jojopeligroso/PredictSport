"use client";

import { useEffect, useState, useCallback } from "react";
import { LoginButton } from "@/components/LoginButton";
import { createClient } from "@/lib/supabase/client";

/**
 * /telegram — Entry point for Telegram Mini App.
 *
 * Loaded inside Telegram's webview when a user taps an inline button.
 * Reads initData from the Telegram WebApp JS SDK, validates it server-side,
 * and either redirects to the app (if already linked) or prompts login.
 *
 * Also works as a normal page (outside Telegram) — falls back to standard login.
 */

type LinkState =
  | { status: "loading" }
  | { status: "linked"; displayName: string }
  | { status: "unlinked"; telegramName: string }
  | { status: "linking" }
  | { status: "no-telegram" }
  | { status: "error"; message: string };

export default function TelegramPage() {
  const [state, setState] = useState<LinkState>({ status: "loading" });
  const [initData, setInitData] = useState<string | null>(null);

  // Step 1: Check if we're inside Telegram and get initData
  useEffect(() => {
    // The Telegram WebApp JS sets window.Telegram.WebApp
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void } } }).Telegram?.WebApp;

    if (!tg?.initData) {
      setState({ status: "no-telegram" });
      return;
    }

    // Tell Telegram the app is ready
    tg.ready?.();
    setInitData(tg.initData);
  }, []);

  // Step 2: Once we have initData, check if this Telegram user is linked
  useEffect(() => {
    if (!initData) return;

    async function checkLink() {
      try {
        const res = await fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: initData }),
        });

        const data = await res.json();

        if (!res.ok) {
          setState({ status: "error", message: data.error ?? "Auth check failed" });
          return;
        }

        if (data.linked) {
          setState({ status: "linked", displayName: data.user.display_name });
          // Redirect to the app after a brief flash
          const params = new URLSearchParams(window.location.search);
          const dest = params.get("startapp") ?? "predictions";
          setTimeout(() => {
            window.location.href = `/${dest}`;
          }, 500);
        } else {
          setState({
            status: "unlinked",
            telegramName: data.telegram_user?.first_name ?? "there",
          });
        }
      } catch {
        setState({ status: "error", message: "Network error" });
      }
    }

    checkLink();
  }, [initData]);

  // Step 3: After login, link the Telegram account to the Supabase user
  const handlePostLogin = useCallback(async () => {
    if (!initData) return;
    setState({ status: "linking" });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setState({ status: "error", message: "Login succeeded but no session found" });
        return;
      }

      const res = await fetch("/api/telegram/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          init_data: initData,
          supabase_token: session.access_token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Linking failed" });
        return;
      }

      // Linked — redirect
      const params = new URLSearchParams(window.location.search);
      const dest = params.get("startapp") ?? "predictions";
      window.location.href = `/${dest}`;
    } catch {
      setState({ status: "error", message: "Network error during linking" });
    }
  }, [initData]);

  // Listen for auth state changes (login completing)
  useEffect(() => {
    if (state.status !== "unlinked") return;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        handlePostLogin();
      }
    });

    return () => subscription.unsubscribe();
  }, [state.status, handlePostLogin]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)]">
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

        {/* Logo */}
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706]"
            aria-hidden="true"
          >
            <span className="font-display text-[22px] leading-none tracking-wide text-ps-text">
              PS
            </span>
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-ps-text">
              PredictSport
            </p>
            <p className="text-[11.5px] leading-tight text-ps-text-sec">
              Predict. Compete. Have the craic.
            </p>
          </div>
        </div>

        {/* State-dependent content */}
        {state.status === "loading" && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            Connecting...
          </p>
        )}

        {state.status === "linked" && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            Welcome back, {state.displayName}! Redirecting...
          </p>
        )}

        {state.status === "linking" && (
          <p className="py-8 text-center text-sm text-ps-text-sec">
            Linking your Telegram account...
          </p>
        )}

        {state.status === "unlinked" && (
          <>
            <p className="mb-4 text-center text-sm text-ps-text-sec">
              Hey {state.telegramName}! Sign in to link your Telegram account.
            </p>
            <LoginButton redirectTo="/telegram" />
          </>
        )}

        {state.status === "no-telegram" && (
          <>
            <p className="mb-4 text-center text-sm text-ps-text-sec">
              Open this page from the Telegram bot to link your account.
            </p>
            <LoginButton redirectTo="/" />
          </>
        )}

        {state.status === "error" && (
          <div className="py-4">
            <div className="mb-4 rounded-xl border border-ps-red bg-ps-red-soft p-3 text-sm text-ps-red">
              {state.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex w-full items-center justify-center rounded-xl border border-ps-border bg-transparent px-4 py-3 text-sm font-medium text-ps-text transition-colors hover:bg-ps-surface"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
