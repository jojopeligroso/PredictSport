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
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            PREDICT
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Sign in to make your predictions
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error === "auth" ? (
              "Authentication failed. Please try again."
            ) : (
              error
            )}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {message}
          </div>
        )}

        <LoginButton />

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
          By signing in, you agree to participate in friendly sports prediction
          competitions. No betting or wagering involved.
        </p>
      </div>
    </div>
  );
}
