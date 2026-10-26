"use client";

import { useEffect, useState } from "react";

// The user box at the bottom of the CMS sidebar ("Hi, <name>" + Admin).
// Reads the real logged-in username so it never shows a hardcoded name.
export default function SidebarUser() {
  const [username, setUsername] = useState<string | null>(null);

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

  return (
    <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#003087", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {displayName.charAt(0)}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: "#333" }}>Hi{displayName ? `, ${displayName}` : ""}</div>
        <div style={{ fontSize: 10, color: "#888" }}>Admin</div>
      </div>
      <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#4caf50" }} title="Online" />
    </div>
  );
}
