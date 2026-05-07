import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // Redirect authenticated users straight to predictions
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/predictions");
  }

  // Unauthenticated: landing that matches the prototype entry feel
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {/* PS logo mark */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] shadow-lg"
          aria-hidden="true"
        >
          <span className="font-display text-3xl leading-none tracking-wide text-[#1a1208]">
            PS
          </span>
        </div>

        {/* Wordmark */}
        <div>
          <h1 className="text-2xl uppercase tracking-[0.06em]">
            <span className="font-light text-ps-text">Predict</span>
            <span className="font-bold text-ps-amber-deep">Sport</span>
          </h1>
          <p className="mt-1.5 text-sm text-ps-text-ter">The Sheet</p>
        </div>

        {/* Tagline */}
        <p className="max-w-xs text-[0.82rem] leading-relaxed text-ps-text-sec">
          Sports prediction quiz for your group. Pick winners, earn points,
          climb the leaderboard.
        </p>

        {/* Primary CTA */}
        <div className="w-full">
          <Link
            href="/login"
            className="block w-full rounded-xl bg-[#111] px-6 py-3.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        <p className="text-xs text-ps-text-ter">
          No betting. No wagering. Just bragging rights.
        </p>
      </div>
    </div>
  );
}
