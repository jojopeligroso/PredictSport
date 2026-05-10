import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
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
  const next = params?.next;

  return (
    /* Full-viewport centering; bg-ps-bg so the page behind the card matches */
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {/*
        Bottom-sheet card translated to web: max-w-sm centered card with
        rounded top corners on mobile (rounded-t-[22px]) and full rounding
        on larger screens (sm:rounded-2xl). Shadow mimics the sheet lifting
        off the background.
      */}
      <div className="w-full max-w-sm rounded-[22px] bg-ps-bg px-5 pb-7 pt-5 shadow-[0_-10px_40px_rgba(40,30,20,0.15)]">
        {/* Drag handle (decorative, matches bottom-sheet prototype) */}
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ps-border" />

        {/* Logo row: 44px square + name + subtitle */}
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
            <p className="text-base font-extrabold lowercase leading-tight tracking-tight text-ps-text">
              sports<span className="text-ps-amber">predict.</span>
            </p>
            <p className="font-serif text-[11.5px] italic leading-tight text-ps-text-sec">
              Call it before the lads do.
            </p>
          </div>
        </div>

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

        {/* Auth buttons */}
        <LoginButton redirectTo={next} />

        {/* Caption */}
        <p className="mt-2.5 text-center text-[11px] text-ps-text-ter">
          By signing in you agree to our{" "}
          <a href="/terms" className="underline hover:text-ps-text">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-ps-text">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
