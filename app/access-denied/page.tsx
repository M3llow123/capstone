export default function AccessDeniedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#f4f6f8",
        fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
      }}
    >
      <section
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
        <div style={{ color: "#003087", fontSize: 22, fontWeight: 700, letterSpacing: ".02em" }}>
          PAGASA
        </div>
        <div style={{ marginTop: 2, color: "#888", fontSize: 12 }}>
          Website Content Management System
        </div>
        <div style={{ marginTop: 22, color: "#003087", fontSize: 64, fontWeight: 800, lineHeight: 0.9 }}>
          403
        </div>
        <h1 style={{ margin: "18px 0 8px", fontSize: 20 }}>Access Restricted</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          This admin area can only be opened by a registered device IP address.
        </p>
      </section>
    </main>
  );
}
