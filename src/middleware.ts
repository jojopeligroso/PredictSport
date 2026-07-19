import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const SHELL_MODE =
  process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_shell";

const ARCHIVE_MODE =
  process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_archive";

/** Routes accessible even in shell mode. */
const SHELL_ALLOWED = [
  "/wc",
  "/login",
  "/auth",
  "/profile",
  "/terms",
  "/privacy",
  "/api",
  "/predictions",
  "/competitions",
  "/leaderboard",
];

/** Routes accessible in archive (display) mode — read-only surfaces only. */
const ARCHIVE_ALLOWED = [
  "/wc",
  "/wc/home",
  "/wc/leaderboard",
  "/wc/bracket",
  "/wc/entrant",
  "/wc/picks",
  "/wc/rules",
  "/wc/faq",
  "/wc/results",
  "/api/tournament/standings",
  "/api/tournament/all-groups",
  "/api/tournament/community-picks",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ARCHIVE_MODE) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/wc", request.url));
    }

    const allowed = ARCHIVE_ALLOWED.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (!allowed) {
      if (pathname.startsWith("/api")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      return NextResponse.redirect(new URL("/wc", request.url));
    }

    // Block non-GET requests even on allowed paths (archive = read-only).
    if (request.method !== "GET") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // No auth session in archive mode — skip cookie refresh entirely.
    return NextResponse.next();
  }

  if (SHELL_MODE) {
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
    "/((?!_next/static|_next/image|favicon.ico|api/notifications|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|json|js|css|woff2?)$).*)",
  ],
};
