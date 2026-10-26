import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUsername } from "../../lib/auth";

// Tells the client who is logged in (the session cookie is httpOnly).
export async function GET(req: NextRequest) {
  const username = await getSessionUsername(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );
  if (!username) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  return NextResponse.json({ username });
}