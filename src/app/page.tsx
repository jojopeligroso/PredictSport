import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/predictions");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4">
      {/* Hero */}
      <section className="flex w-full max-w-md flex-col items-center gap-8 pt-16 pb-12 text-center md:pt-24 md:pb-16">
        <BrandMark className="h-20 w-auto md:h-28" />

        <div>
          <h1 className="text-4xl font-extrabold lowercase tracking-tight text-ps-text md:text-5xl">
            sports<span className="text-ps-amber">predict.</span>
          </h1>
          <p className="mt-3 font-serif text-lg italic text-ps-text-sec md:text-xl">
            Call it before the lads do.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full max-w-xs rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97] md:text-lg"
        >
          Get started
        </Link>
      </section>

      {/* How it works */}
      <section className="w-full max-w-md border-t border-ps-border pt-10 pb-12">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          How it works
        </h2>

        <div className="mt-8 space-y-8">
          <Step
            number="1"
            title="Join a group"
            description="Your mate sends a link. You're in. No downloads, no sign-up forms — just Google and go."
          />
          <Step
            number="2"
            title="Make your picks"
            description="Each round has a mix of fixtures across sports. Pick your winners before the deadline locks."
          />
          <Step
            number="3"
            title="Climb the table"
            description="Points land as results come in. See where you stand, who called it, and who got it very wrong."
          />
        </div>
      </section>

      {/* What it is / what it isn't */}
      <section className="w-full max-w-md border-t border-ps-border pt-10 pb-14">
        <div className="rounded-2xl border border-ps-border bg-ps-surface p-6">
          <p className="text-sm font-medium leading-relaxed text-ps-text">
            For friend groups, not sportsbooks.{" "}
            <span className="text-ps-text-sec">
              No money changes hands. No odds. No algorithms. Just bragging
              rights, banter, and the cold satisfaction of being right.
            </span>
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="w-full max-w-md pb-16 text-center">
        <Link
          href="/login"
          className="inline-block rounded-xl bg-ps-text px-8 py-3.5 text-sm font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          Get started
        </Link>
        <p className="mt-4 text-xs text-ps-text-ter">
          Free. No app store required.
        </p>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-text text-sm font-bold text-ps-bg">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-bold text-ps-text">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ps-text-sec">
          {description}
        </p>
      </div>
    </div>
  );
}
