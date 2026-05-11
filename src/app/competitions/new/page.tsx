import { redirect } from "next/navigation";
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
    <div className="mx-auto max-w-[480px] px-4 py-6">
      <CreateCompetitionForm alwaysOpen />
    </div>
  );
}
