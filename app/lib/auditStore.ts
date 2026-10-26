// ── Audit log store (backed by Supabase) ──────────────────────────────
// Entries live in the "audit_log" table. The browser talks to /api/audit,
// and the SERVER decides who did the action from the signed session cookie,
// so a name can't be faked from the client.
//
// The functions keep the same shape as before (getAuditLog is synchronous and
// returns what is loaded so far; onAuditChanged fires when new data arrives),
// so the pages that use them don't need to change.

export interface AuditEntry {
  id: string;
  name: string;    // who did it
  action: string;  // e.g. "UPDATE REGIONS IMPACT"
  detail?: string; // e.g. "Region 3 Central Luzon"
  date: string;    // ISO timestamp
}

const EVENT_NAME = "pagasa-audit-updated";
const MAX_ENTRIES = 1000;

let auditCache: AuditEntry[] = [];
let loadState: "idle" | "loading" | "done" = "idle";

function emit() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Reload the audit log from the database. */
export async function refreshAuditLog(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/audit", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    auditCache = Array.isArray(data?.entries) ? data.entries : [];
    emit();
  } catch (err) {
    console.error("Could not load the audit log:", err);
  } finally {
    loadState = "done";
  }
}

function ensureLoaded() {
  if (typeof window === "undefined" || loadState !== "idle") return;
  loadState = "loading";
  void refreshAuditLog();
}

/** Newest first. Starts empty and fills in a moment later (onAuditChanged fires). */
export function getAuditLog(): AuditEntry[] {
  ensureLoaded();
  return [...auditCache];
}

/**
 * Record an action. Fire-and-forget: call it without await so it never
 * slows down or breaks the save that triggered it.
 * The `username` argument is kept so old calls still compile, but the server
 * always uses the logged-in user from the session cookie.
 */
export async function logAudit(action: string, detail?: string, username?: string): Promise<void> {
  if (typeof window === "undefined") return;
  void username;
  try {
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, detail }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.entry) {
      auditCache = [data.entry as AuditEntry, ...auditCache].slice(0, MAX_ENTRIES);
      emit();
    }
  } catch {
    /* never break the caller */
  }
}

export function onAuditChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  ensureLoaded();
  window.addEventListener(EVENT_NAME, cb);
  return () => window.removeEventListener(EVENT_NAME, cb);
}