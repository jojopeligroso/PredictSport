/**
 * /wc/join — WC-branded invite code entry page.
 *
 * Auth-gated server component. Renders a form where an authenticated user
 * can enter an invite token. On submit, the client component redirects to
 * /join?token=… which handles the actual enrollment logic.
 *
 * If not authenticated, redirects to /login?next=/wc/join.
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { JoinWithCode } from "./join-with-code";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join — FIFA World Cup 2026",
  description:
    "Enter your invite code to join a World Cup 2026 prediction competition.",
};

export default async function WcJoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/join");
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title="Join a Competition"
        subtitle="Enter the code you were given."
        backHref="/wc"
        backLabel="Back to World Cup"
        className="mb-2"
      />

      <JoinWithCode />
    </div>
  );
}
