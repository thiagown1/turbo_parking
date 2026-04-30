import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "tp_session";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/auth/login",
  "/api/auth/session",
  "/api/sessions",     // API key protected (machine-to-machine)
  "/api/config",       // API key protected
  "/api/health",
  "/",
];

function isPublicRoute(pathname: string): boolean {
  // Exact matches
  if (PUBLIC_ROUTES.includes(pathname)) return true;

  // Prefix matches for API routes (protected by API key, not session)
  if (pathname.startsWith("/api/sessions")) return true;
  if (pathname.startsWith("/api/config")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/api/auth")) return true;

  // Static assets
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;

  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — allow through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    // No session — redirect to login
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through.
  // The actual token verification happens server-side when needed.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
