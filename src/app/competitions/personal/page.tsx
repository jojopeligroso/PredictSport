import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PersonalFixtureBrowser } from "./PersonalFixtureBrowser";

export default async function PersonalPredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/competitions"
          className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-ps-text-ter hover:text-ps-text transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Competitions
        </Link>
        <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
          Just for you
        </p>
        <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-ps-text leading-none mt-0.5">
          My Personal Predictions
        </h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          Pick outcomes on any fixture. No competition required.
        </p>
      </div>

      <PersonalFixtureBrowser />
    </div>
  );
}
