import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./app/lib/auth";

// Runs before the page loads. Not logged in + protected page -> back to login.
// Logged in + login page ("/") -> straight to the uploader.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );

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

// Login page + every uploader / editor page. /report and /chat stay public.
export const config = {
  matcher: [
    "/",
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
  ],
};
