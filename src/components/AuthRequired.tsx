import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface AuthRequiredProps {
  children: React.ReactNode;
}

export async function AuthRequired({ children }: AuthRequiredProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-ps-border bg-ps-surface p-8">
          <svg
            className="mx-auto h-12 w-12 text-ps-text-ter"
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
          <h2 className="mt-4 text-lg font-semibold text-ps-text">
            Sign in required
          </h2>
          <p className="mt-2 text-sm text-ps-text-sec">
            You need to be logged in to access this page.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-6 py-2 text-sm font-extrabold text-[#1a1208] transition-opacity hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
