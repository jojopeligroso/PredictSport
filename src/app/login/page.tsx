import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16">
      <div className="w-full space-y-6">
        {/* Logo + heading */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706]">
            <span className="text-lg font-bold leading-none text-[#1a1208]">PS</span>
          </div>
          <h1 className="text-xl uppercase tracking-[0.06em]">
            <span className="font-light text-ps-text">Predict</span>
            <span className="font-bold text-ps-amber-deep">Sport</span>
          </h1>
          <p className="mt-2 text-sm text-ps-text-sec">
            Sign in to make your predictions
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-ps-red bg-ps-red-soft p-4 text-sm text-ps-red">
            {error === "auth"
              ? "Authentication failed. Please try again."
              : error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-ps-border bg-ps-surface p-4 text-sm text-ps-text-sec">
            {message}
          </div>
        )}

        <div className="rounded-2xl border border-ps-border bg-ps-surface p-6">
          <LoginButton />
        </div>

        <p className="text-center text-xs leading-relaxed text-ps-text-ter">
          One tap. You&apos;ll be auto-joined to the Sheet.
        </p>
      </div>
    </div>
  );
}
