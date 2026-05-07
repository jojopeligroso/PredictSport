import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const error = params?.error;
  const message = params?.message;

  return (
    /* Full-viewport centering; bg-ps-bg so the page behind the card matches */
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {/*
        Bottom-sheet card translated to web: max-w-sm centered card with
        rounded top corners on mobile (rounded-t-[22px]) and full rounding
        on larger screens (sm:rounded-2xl). Shadow mimics the sheet lifting
        off the background.
      */}
      <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)]">
        {/* Drag handle (decorative, matches bottom-sheet prototype) */}
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

        {/* Logo row: 44px square + name + subtitle */}
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706]"
            aria-hidden="true"
          >
            <span className="font-display text-[22px] leading-none tracking-wide text-[#1a1208]">
              PS
            </span>
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-ps-text">
              PredictSport
            </p>
            <p className="text-[11.5px] leading-tight text-ps-text-sec">
              The Sheet · 12 lads
            </p>
          </div>
        </div>

        {/* Invite teaser */}
        <p className="mb-4 text-sm leading-snug text-ps-text">
          You&apos;ve been invited to{" "}
          <strong>Round 7 — Wexford Sheet</strong>. 5 events, locks at
          kickoff.
        </p>

        {/* Error / info banners */}
        {error && (
          <div className="mb-4 rounded-xl border border-ps-red bg-ps-red-soft p-3 text-sm text-ps-red">
            {error === "auth"
              ? "Authentication failed. Please try again."
              : error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-ps-border bg-ps-surface p-3 text-sm text-ps-text-sec">
            {message}
          </div>
        )}

        {/* Big black CTA */}
        <LoginButton />

        {/* Caption */}
        <p className="mt-2.5 text-center text-[11px] text-ps-text-ter">
          One tap. You&apos;ll be auto-joined to the Sheet.
        </p>
      </div>
    </div>
  );
}
