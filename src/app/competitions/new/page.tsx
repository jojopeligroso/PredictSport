import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCompetitionForm } from "@/app/admin/components/CreateCompetitionForm";

export default async function NewCompetitionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-[480px] md:max-w-2xl mx-auto px-4 py-6">
      <Link
        href="/competitions"
        className="text-sm font-medium text-ps-text-sec hover:text-ps-text"
      >
        &lt; Back to Competitions
      </Link>

      <h1 className="font-display font-extrabold text-xl uppercase tracking-tight text-ps-text mt-4">
        Start a Competition
      </h1>
      <p className="text-sm text-ps-text-sec mt-1">
        Give it a name, pick a scoring style, and you&apos;re away.
      </p>

      <div className="mt-6">
        <CreateCompetitionForm alwaysOpen />
      </div>
    </div>
  );
}
