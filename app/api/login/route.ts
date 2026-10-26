import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  safeEqual,
} from "../../lib/auth";
import { recordAuthEvent } from "../../lib/loginLog";

// Users come from .env.local:
//   USERS="juan:pass1,maria:pass2"
// ADMIN_USERNAME / ADMIN_PASSWORD still work as one extra user.
function loadUsers(): { username: string; password: string }[] {
  const { USERS, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  const list: { username: string; password: string }[] = [];

  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    list.push({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  }
  if (USERS) {
    for (const pair of USERS.split(",")) {
      const i = pair.indexOf(":");
      if (i > 0) {
        list.push({
          username: pair.slice(0, i).trim(),
          password: pair.slice(i + 1).trim(),
        });
      }
    }
  }
  return list;
}

export async function POST(req: NextRequest) {
  const { AUTH_SECRET } = process.env;
  const users = loadUsers();

  if (users.length === 0 || !AUTH_SECRET) {
    return NextResponse.json(
      { error: "Login is not configured. Set USERS (or ADMIN_USERNAME and ADMIN_PASSWORD) and AUTH_SECRET in .env.local." },
      { status: 500 }
    );
  }

  let username = "";
  let password = "";
  try {
    ({ username, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Check every user (no early exit) so timing doesn't reveal which names exist
  let matched: string | null = null;
  for (const u of users) {
    const ok =
      safeEqual(String(username ?? ""), u.username) &&
      safeEqual(String(password ?? ""), u.password);
    if (ok) matched = u.username;
  }

  if (!matched) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  await recordAuthEvent(matched, "LOGIN");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(AUTH_SECRET, matched), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}