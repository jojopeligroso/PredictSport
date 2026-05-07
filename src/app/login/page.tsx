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
    <div className="flex flex-1 flex-col items-center justify-center bg-ps-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide text-ps-text">
            PREDICT
          </h1>
          <p className="mt-3 text-ps-text-sec">
            Sign in to make your predictions
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error === "auth" ? (
              "Authentication failed. Please try again."
            ) : (
              error
            )}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-ps-border bg-ps-surface p-4 text-sm text-ps-text-sec">
            {message}
          </div>
        )}

        <div className="bg-ps-surface border border-ps-border rounded-2xl p-6">
          <LoginButton />
        </div>

        <p className="text-center text-xs text-ps-text-ter">
          By signing in, you agree to participate in friendly sports prediction
          competitions. No betting or wagering involved.
        </p>
      </div>
    </div>
  );
}
