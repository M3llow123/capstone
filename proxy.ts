import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAllowedAdminIp,
  SESSION_COOKIE,
  verifySessionToken,
} from "./app/lib/auth";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same job: runs before the
// route renders). Do NOT also add a middleware.ts, Next will refuse to build.
//
// S1: every admin page and every admin API requires a valid session cookie.
//  - Not logged in + admin page  -> redirect to "/" (the login page)
//  - Not logged in + admin API   -> 401 JSON
//  - Not an allowed IP           -> admin pages are never shown

// Every page that is part of the admin / CMS area. Add new admin pages here
// (and to `config.matcher` below). Anything under /admin is covered as well.
const ADMIN_PAGE_PREFIXES = [
  "/admin",
  "/uploader",
  "/regions",
  "/overview",
  "/preface",
  "/cover-page",
  "/about-this-report",
  "/monthly-rainfall",
  "/tropical-cyclone",
  "/rice-crop-stage",
  "/corn-crop-stage",
  "/crop-condition-drought",
  "/audit-log",
];

// Segment-aware prefix match: "/admin" and "/admin/x" match, "/administrator" does not.
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAdminPagePath(pathname: string): boolean {
  return ADMIN_PAGE_PREFIXES.some(p => matchesPrefix(pathname, p));
}

// APIs that need a logged-in admin. /api/login must stay open (it creates the
// session) and /api/logout + /api/me answer for themselves.
function requiresSessionApi(pathname: string, method: string): boolean {
  if (matchesPrefix(pathname, "/api/audit")) return true;
  if (matchesPrefix(pathname, "/api/chat")) return true;
  if (matchesPrefix(pathname, "/api/content")) return method !== "GET";
  return false;
}

function isAdminApiPath(pathname: string, method: string): boolean {
  return (
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/me" ||
    requiresSessionApi(pathname, method)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/access-denied") {
    return NextResponse.next();
  }

  // Reading the report content is PUBLIC: every visitor's /report page loads it from here.
  // Without this early exit, visitors who are not logged in fell through to the session check
  // below and were redirected to the login page instead of getting the data, so only the
  // logged-in admin could see regions. Only GET is public; saving (POST) still needs a login.
  if (pathname === "/api/content" && request.method === "GET") {
    return NextResponse.next();
  }

  const isAdminPage = pathname === "/" || isAdminPagePath(pathname);
  const isAdminApi = isAdminApiPath(pathname, request.method);

  // 1) IP allow-list (unchanged behaviour).
  if (!isAllowedAdminIp(request.headers, process.env.ADMIN_ALLOWED_IPS)) {
    if (isAdminApi) {
      return NextResponse.json(
        { error: "Access denied. This admin area is restricted to registered IP addresses." },
        { status: 403 }
      );
    }
    if (isAdminPage) {
      if (pathname === "/") {
        return NextResponse.redirect(new URL("/report", request.url));
      }
      return NextResponse.rewrite(new URL("/access-denied", request.url));
    }
  }

  // 2) Session check. Fails closed: a missing cookie, bad signature, expired
  //    token, or missing AUTH_SECRET all count as "not logged in".
  const loggedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );

  if (isAdminApi) {
    if (requiresSessionApi(pathname, request.method) && !loggedIn) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return loggedIn
      ? NextResponse.redirect(new URL("/uploader", request.url))
      : NextResponse.next();
  }

  if (!loggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

// The proxy only runs on these paths. /report and /chat stay public.
// `/admin/:path*` also matches `/admin` itself.
export const config = {
  matcher: [
    "/",
    "/access-denied",
    "/admin/:path*",
    "/api/login",
    "/api/logout",
    "/api/me",
    "/api/audit/:path*",
    "/api/chat",
    "/api/content",
    "/uploader/:path*",
    "/regions/:path*",
    "/overview/:path*",
    "/preface/:path*",
    "/cover-page/:path*",
    "/about-this-report/:path*",
    "/monthly-rainfall/:path*",
    "/tropical-cyclone/:path*",
    "/rice-crop-stage/:path*",
    "/corn-crop-stage/:path*",
    "/crop-condition-drought/:path*",
    "/audit-log/:path*",
  ],
};