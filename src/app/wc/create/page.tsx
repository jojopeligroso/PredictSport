/**
 * /wc/create — Create a World Cup 2026 prediction competition.
 *
 * Server component wrapper. Auth-gates the page; unauthenticated visitors are
 * redirected to /login?next=/wc/create. Authenticated users see the
 * CreateWcCompetition client form.
 */
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { CreateWcCompetition } from "./CreateWcCompetition";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create — FIFA World Cup 2026",
  description: "Create your own World Cup 2026 prediction competition.",
};

export default async function WcCreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/create");
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title="Create a Competition"
        subtitle="Set up your own World Cup prediction game."
        backHref="/wc"
        backLabel="Back to World Cup"
        className="mb-8"
      />

      <CreateWcCompetition />
    </div>
  );
}
