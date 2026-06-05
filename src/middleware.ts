import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const SHELL_MODE =
  process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_shell";

/** Routes accessible even in shell mode. */
const SHELL_ALLOWED = [
  "/wc",
  "/login",
  "/auth",
  "/profile",
  "/terms",
  "/privacy",
  "/telegram",
  "/api",
  "/predictions",
  "/competitions",
  "/leaderboard",
];

export async function middleware(request: NextRequest) {
  if (SHELL_MODE) {
    const { pathname } = request.nextUrl;

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/wc", request.url));
    }

    const allowed = SHELL_ALLOWED.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (!allowed) {
      return NextResponse.redirect(new URL("/wc", request.url));
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/telegram|api/notifications|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
