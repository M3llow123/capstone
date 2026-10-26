"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logAudit } from "./lib/auditStore";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }
      await logAudit("LOGIN", undefined, username);
      router.push("/uploader");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ced4da",
    borderRadius: 4, outline: "none", fontFamily: "inherit", color: "#333", background: "#fff",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f4f6f8", fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif", padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #dde3ea",
        borderRadius: 6, padding: "28px 28px 24px", boxShadow: "0 2px 10px rgba(0,0,0,.06)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pagasa-logo.png" alt="PAGASA logo" width={72} height={72} style={{ display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Website Content Management System</div>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Username</label>
        <input
          type="text" value={username} onChange={(e) => setUsername(e.target.value)}
          autoComplete="username" autoFocus required style={{ ...inputStyle, marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required style={{ ...inputStyle, marginBottom: 14 }}
        />

        {error && (
          <div role="alert" style={{
            fontSize: 13, color: "#b71c1c", background: "#fdecea", border: "1px solid #f5c6cb",
            borderRadius: 4, padding: "8px 10px", marginBottom: 14,
          }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "10px 0", fontSize: 14, fontWeight: 600, color: "#fff",
          background: loading ? "#6b83b3" : "#003087", border: "none", borderRadius: 4,
          cursor: loading ? "default" : "pointer",
        }}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}