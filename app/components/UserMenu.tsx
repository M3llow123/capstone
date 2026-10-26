"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logAudit } from "../lib/auditStore";

// The "Hi <name>  [Logout]" block for the right side of the CMS top bar.
// Shows the real logged-in username and logs out (and records it in the audit log).
export default function UserMenu() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.username) setUsername(d.username);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : "";

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logAudit("LOGOUT", undefined, username ?? "User");
    } catch {
      /* never block logging out because of the audit log */
    }
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 13, color: "#555" }}>Hi{displayName ? ` ${displayName}` : ""}</span>
      <button
        onClick={handleLogout}
        disabled={busy}
        style={{
          padding: "4px 12px",
          fontSize: 12,
          background: "#fff",
          border: "1px solid #ced4da",
          borderRadius: 3,
          color: "#555",
          cursor: busy ? "default" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {busy ? "Logging out…" : "Logout"}
      </button>
    </div>
  );
}
