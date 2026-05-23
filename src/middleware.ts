import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const SHELL_MODE =
  process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_shell";

/** Routes that shell mode redirects to /wc */
const SHELL_REDIRECTS = [
  "/competitions",
  "/competitions/personal",
  "/competitions/new",
  "/predictions",
];

export async function middleware(request: NextRequest) {
  // Shell mode: redirect generic routes to /wc
  if (SHELL_MODE) {
    const { pathname } = request.nextUrl;

    // Redirect root to /wc landing
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/wc", request.url));
    }

    if (
      SHELL_REDIRECTS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      )
    ) {
      return NextResponse.redirect(new URL("/wc", request.url));
    }
  }

  const response = await updateSession(request);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
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
