import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUsername } from "../../lib/auth";
import { recordAuthEvent } from "../../lib/loginLog";

// Records the logout, then clears the session cookie.
export async function POST(req: NextRequest) {
  // Read who is logging out before the cookie is cleared (an expired session has no name to record).
  const username = await getSessionUsername(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );
  if (username) await recordAuthEvent(username, "LOGOUT");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}