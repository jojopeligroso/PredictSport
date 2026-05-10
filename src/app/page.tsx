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

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 md:py-28">
      <div className="flex w-full max-w-sm flex-col items-center gap-10 text-center md:max-w-md md:gap-12">
        {/* Brand mark */}
        <BrandMark className="h-24 w-auto md:h-32" />

        {/* Wordmark + tagline */}
        <div>
          <h1 className="text-4xl font-extrabold lowercase tracking-tight text-ps-text md:text-5xl">
            sports<span className="text-ps-amber">predict.</span>
          </h1>
          <p className="mt-3 font-serif text-lg italic text-ps-text-sec md:mt-4 md:text-xl">
            Call it before the lads do.
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/login"
          className="w-full max-w-xs rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97] md:text-lg"
        >
          Get started
        </Link>

        <p className="text-xs text-ps-text-ter md:text-sm">
          Predict. Compete. Have the craic.
        </p>
      </div>
    </div>
  );
}
