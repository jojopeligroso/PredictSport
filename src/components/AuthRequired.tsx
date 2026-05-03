import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface AuthRequiredProps {
  children: React.ReactNode;
}

/**
 * Server component wrapper that checks auth state.
 * Shows a "please log in" message if the user is not authenticated,
 * otherwise renders the children.
 *
 * Usage:
 *   <AuthRequired>
 *     <ProtectedContent />
 *   </AuthRequired>
 */
export async function AuthRequired({ children }: AuthRequiredProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <svg
            className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Sign in required
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You need to be logged in to access this page.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
