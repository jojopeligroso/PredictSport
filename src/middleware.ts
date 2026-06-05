import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  // Root → /wc during World Cup (soft redirect, all other routes accessible)
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/wc", request.url));
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
