import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUsername } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  name: string;
  action: string;
  detail: string | null;
  created_at: string;
};

function toEntry(row: AuditRow) {
  return {
    id: row.id,
    name: row.name,
    action: row.action,
    detail: row.detail ?? undefined,
    date: row.created_at,
  };
}

function currentUser(req: NextRequest) {
  return getSessionUsername(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
}

type LoginRow = {
  id: string;
  name: string;
  action: string; // "LOGIN" | "LOGOUT"
  created_at: string;
};

// Read the audit log (logged-in users only), newest first.
// Login/logout events live in their own table ("login_logout_log") and are merged in here,
// so they show up on the Audit Log page without being copied into audit_log.
export async function GET(req: NextRequest) {
  if (!(await currentUser(req))) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const [audit, auth] = await Promise.all([
    supabaseAdmin
      .from("audit_log")
      .select("id,name,action,detail,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("login_logout_log")
      .select("id,name,action,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (audit.error) return NextResponse.json({ error: audit.error.message }, { status: 500 });

  // If the login/logout table isn't set up yet, still show the normal audit log.
  if (auth.error) console.error("Could not read login_logout_log:", auth.error.message);
  const authEntries = ((auth.data ?? []) as LoginRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    action: r.action,
    date: r.created_at,
  }));

  const entries = [...(audit.data as AuditRow[]).map(toEntry), ...authEntries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 1000);

  return NextResponse.json({ entries });
}

// Record an action. The name always comes from the session, never from the request.
export async function POST(req: NextRequest) {
  const username = await currentUser(req);
  if (!username) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let action = "";
  let detail: string | undefined;
  try {
    const body = await req.json();
    action = String(body?.action ?? "").slice(0, 200);
    if (body?.detail != null) detail = String(body.detail).slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!action.trim()) return NextResponse.json({ error: "Missing action." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .insert({ name: username, action, detail: detail ?? null })
    .select("id,name,action,detail,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: toEntry(data as AuditRow) });
}