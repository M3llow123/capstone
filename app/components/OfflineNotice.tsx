"use client";

import { useEffect, useState } from "react";

export default function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);

    updateConnection();
    window.addEventListener("offline", updateConnection);
    window.addEventListener("online", updateConnection);

    return () => {
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("online", updateConnection);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f4f6f8",
        color: "#1f2937",
        fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "min(380px, 100%)",
          boxSizing: "border-box",
          textAlign: "center",
          background: "#fff",
          border: "1px solid #dde3ea",
          borderRadius: 6,
          padding: "28px 28px 24px",
          boxShadow: "0 2px 10px rgba(0,0,0,.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pagasa-logo.png"
          alt="PAGASA logo"
          width={72}
          height={72}
          style={{ display: "block", margin: "0 auto 8px" }}
        />
        <div
          style={{
            color: "#003087",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: ".02em",
          }}
        >
          PAGASA
        </div>
        <div style={{ marginTop: 2, color: "#888", fontSize: 12 }}>
          Website Content Management System
        </div>
        <div
          style={{
            marginTop: 22,
            color: "#003087",
            fontSize: "clamp(64px, 18vw, 96px)",
            fontWeight: 800,
            lineHeight: 0.9,
          }}
        >
          404
        </div>
        <h1
          id="offline-title"
          style={{ margin: "18px 0 8px", fontSize: 20 }}
        >
          No Internet Connection
        </h1>
        <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          The page could not be loaded because your device is offline.
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 4,
            background: "#003087",
            color: "#fff",
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
