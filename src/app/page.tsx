import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export default async function Home() {
  // Redirect authenticated users straight to predictions
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/predictions");
  }

  // Unauthenticated: landing that matches the stacked lockup splash
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-10 text-center">
        {/* Brand mark — big, centered, commanding */}
        <BrandMark className="h-24 w-auto" />

        {/* Wordmark + tagline */}
        <div>
          <h1 className="text-4xl font-extrabold lowercase tracking-tight text-ps-text">
            sports<span className="text-ps-amber">predict.</span>
          </h1>
          <p className="mt-3 font-serif text-lg italic text-ps-text-sec">
            Call it before the lads do.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="w-full">
          <Link
            href="/login"
            className="block w-full rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        <p className="text-xs text-ps-text-ter">
          Predict. Compete. Have the craic.
        </p>
      </div>
    </div>
  );
}
