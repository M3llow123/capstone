"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuditLogNav from "./AuditLogNav";

// ── Types ──────────────────────────────────────────────────────────────
interface ImageItem { file: File; url: string; name: string; }
interface Message { role: "user" | "assistant"; content: string; images: ImageItem[]; }
interface ApiContentBlock { type: string; text?: string; source?: any; }
interface ApiMessage { role: "user" | "assistant"; content: string | ApiContentBlock[]; }

// ── System Prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI Climate Interpretation Assistant for DOST-PAGASA Agri-Weather Systems.

Your role is to generate short regional agricultural climate summaries based on uploaded climate and crop condition maps.

The writing must closely resemble official PAGASA regional agri-weather bulletins in tone, simplicity, and structure.

The output should sound like a human-written government weather report — calm, concise, observational, and easy to understand.

INPUT MAPS MAY INCLUDE

vegetation condition maps
moisture condition maps
rainfall maps
extreme rainfall maps
crop water condition maps
rice and corn growth stage maps

Interpret all uploaded maps together as ONE regional agricultural assessment.

MAIN OBJECTIVE

Generate a short regional summary describing:

general rainfall condition
vegetation condition
moisture condition
possible crop condition
possible impact on rice and corn

Focus only on broad regional conditions and localized variation.

Do NOT explain the science behind the maps.

Do NOT describe how the data behaves.

Describe only what the maps generally indicate.

OUTPUT FORMAT (STRICT)

[REGION NAME]

REGIONAL SUMMARY:
Write ONLY 2 short paragraphs.

Maximum total length: 90–120 words.

Do NOT include:

bullet points
numbered lists
conclusions
recommendations
forecasts
warnings
extra headings
technical explanations

Output only the final regional summary.

WRITING STYLE RULES (VERY IMPORTANT)

The report must sound like a real PAGASA regional bulletin.

Writing style must be:

simple
natural
concise
observational
neutral
cautious
non-technical

Use short and clear sentences.

Prefer soft and indirect wording.

Avoid dramatic or overly analytical language.

The summary should read like a routine agricultural weather report, not a scientific analysis or AI-generated explanation.

USE SIMPLE PAGASA-STYLE PHRASES SUCH AS

minimal rainfall
generally fair conditions
localized stress
near-normal conditions
likely insufficient
dry conditions persisted
no significant extreme rainfall events observed
may affect crop development
some areas showed better conditions
vegetation remained generally fair

Keep wording simple and repetitive in a natural bulletin style.
`;

// ── Helpers ────────────────────────────────────────────────────────────
const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

const formatMessage = (text: string): React.ReactNode[] =>
  text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} style={{ height: 6 }} />;
    const isHeader = /^#{1,3} /.test(t) || /^[A-Z][A-Z\s\-—]{3,}:?$/.test(t);
    const isBullet = t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ");
    const clean = t.replace(/^#{1,3} /, "").replace(/\*\*/g, "").replace(/^[-•*] /, "");
    if (isHeader) return (
      <div key={i} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#003087", marginTop: 14, marginBottom: 5 }}>{clean}</div>
    );
    if (isBullet) return (
      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3, paddingLeft: 2 }}>
        <span style={{ color: "#003087", flexShrink: 0, fontSize: 8, marginTop: 5 }}>●</span>
        <span style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>{clean}</span>
      </div>
    );
    return <p key={i} style={{ fontSize: 13, color: "#444", lineHeight: 1.75, margin: "2px 0" }}>{clean}</p>;
  });

// ── Main Component ─────────────────────────────────────────────────────
export default function PagasaChat() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hello! I'm PAGASA AI. Upload your regional climate maps (NDVI, SPEI, RX1day, RX5day) and I'll generate a structured agricultural summary ready for review.",
    images: [],
  }]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("PAGASA AI");
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const handleNavClick = (label: string) => {
    setActiveNav(label);
    // Navigate back to impact assessment page for any of these items
    if (["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"].includes(label)) {
      router.push("/");
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"));
    setPendingImages(prev => [...prev, ...valid.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name }))].slice(0, 6));
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !pendingImages.length) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text || "Please analyze these maps.", images: pendingImages };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setPendingImages([]);
    if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);
    try {
      const apiMessages: ApiMessage[] = await Promise.all(history.map(async m => {
        if (m.role === "assistant") return { role: "assistant" as const, content: m.content };
        const content: any[] = [];
        for (const img of m.images) content.push({ type: "image", source: { type: "base64", media_type: img.file.type, data: await toBase64(img.file) } });
        if (m.content) content.push({ type: "text", text: m.content });
        return { role: "user" as const, content: content.length === 1 && content[0].type === "text" ? content[0].text : content };
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: apiMessages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.find((b: ApiContentBlock) => b.type === "text")?.text ?? "";
      setMessages(prev => [...prev, { role: "assistant", content: reply, images: [] }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages(prev => prev.slice(0, -1));
    } finally { setLoading(false); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: "Hello! I'm PAGASA AI. Upload your regional climate maps (NDVI, SPEI, RX1day, RX5day) and I'll generate a structured agricultural summary ready for review.", images: [] }]);
    setPendingImages([]);
    setError(null);
  };

  const impactChildren = [
    "Corn Crop Stage and Water Sufficiency",
    "Rice Crop Stage and Water Sufficiency",
    "Monthly Rainfall",
    "Tropical Cyclone",
    "Crop Condition and Drought Indicator",
    "Regions",
    "Cover Page",
    "About this Report",
    "Preface",
    "Overview",
  ];

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: "#f4f6f8",
      fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
      color: "#333", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; }

        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; }
        .side-parent:hover { background:#e8edf2; }

        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:.4}50%{opacity:1} }
        .msg { animation: fadeUp .18s ease both; }
        .send-btn:hover:not(:disabled) { background:#1565c0 !important; }
        .send-btn:disabled { opacity:.35; cursor:not-allowed; }
        .attach-btn:hover { color:#003087 !important; }
        textarea { resize:none; outline:none; font-family:inherit; }
        textarea::placeholder { color:#aaa; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200,
        background: "#fff",
        borderRight: "1px solid #dde3ea",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 6 }}>
          {/* Maintenance */}
          <div className="side-parent" onClick={() => setMaintenanceOpen(p => !p)}>
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {maintenanceOpen && ["Dashboard", "Users", "Settings"].map(label => (
            <div key={label} className={`side-link${activeNav === label ? " active" : ""}`} onClick={() => setActiveNav(label)}>{label}</div>
          ))}

          {/* Impact Assessment */}
          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && impactChildren.map(label => (
            <div key={label} className={`side-link${activeNav === label ? " active" : ""}`} onClick={() => handleNavClick(label)}>{label}</div>
          ))}

          {/* AI Tools */}
          <AuditLogNav />
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <div
              className={`side-link${activeNav === "PAGASA AI" ? " active" : ""}`}
              style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => setActiveNav("PAGASA AI")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </div>
          </div>
        </nav>

        {/* User footer */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#003087", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>M</div>
          <div>
            <div style={{ fontWeight: 600, color: "#333" }}>Hi, Admin</div>
            <div style={{ fontSize: 10, color: "#888" }}>Admin</div>
          </div>
          <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#4caf50" }} title="Online" />
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          background: "#fff", borderBottom: "1px solid #dde3ea",
          padding: "10px 24px",
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={clearChat}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 4, background: "rgba(211,47,47,.08)", border: "1px solid rgba(211,47,47,.25)", cursor: "pointer", color: "#d32f2f", fontSize: 12, fontWeight: 600, transition: "all .15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(211,47,47,.16)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(211,47,47,.08)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Clear Chat
            </button>
            <div style={{ fontSize: 13, color: "#555" }}>Hi, Admin &nbsp;▾</div>
          </div>
        </div>

        {/* Page heading */}
        <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 2px" }}>PAGASA AI</h1>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Regional Map Analysis Assistant</div>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 16px" }}>
          {/* FIX: full width + centered container so row-reverse works correctly */}
          <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

            {messages.map((m, i) => (
              // FIX: added width: "100%" so user messages push to the right
              <div
                key={i}
                className="msg"
                style={{
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
                {m.role === "assistant" && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#003087", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
                  </div>
                )}
                {m.role === "user" && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#003087", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>M</div>
                )}

                {/* FIX: alignItems on bubble wrapper so images also align correctly per side */}
                <div style={{
                  maxWidth: "75%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {m.images?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      {m.images.map((img, j) => (
                        <img key={j} src={img.url} alt={img.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #dde3ea" }} />
                      ))}
                    </div>
                  )}
                  {m.content && (
                    <div style={{
                      background: m.role === "user" ? "#003087" : "#fff",
                      border: m.role === "user" ? "none" : "1px solid #dde3ea",
                      borderRadius: m.role === "user" ? "8px 2px 8px 8px" : "2px 8px 8px 8px",
                      padding: "10px 14px",
                      boxShadow: m.role === "assistant" ? "0 1px 3px rgba(0,0,0,.06)" : "none",
                    }}>
                      {m.role === "assistant"
                        ? formatMessage(m.content)
                        : <span style={{ fontSize: 13, color: "#fff", lineHeight: 1.7 }}>{m.content}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="msg" style={{ display: "flex", gap: 10, width: "100%", flexDirection: "row", alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#003087", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", animation: "pulse 1s infinite" }} />
                </div>
                <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: "2px 8px 8px 8px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#003087", opacity: 0.4, animation: "blink 1.1s 0s infinite" }} />
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#003087", opacity: 0.4, animation: "blink 1.1s 0.18s infinite" }} />
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#003087", opacity: 0.4, animation: "blink 1.1s 0.36s infinite" }} />
                  <span style={{ fontSize: 12, color: "#888", marginLeft: 6, fontStyle: "italic" }}>Running analysis...</span>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#d32f2f" }}>
                ⚠ {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input area ── */}
        <div style={{ padding: "0 28px 24px", flexShrink: 0 }}>
          <div style={{ maxWidth: 760, width: "100%", margin: "0 auto" }}>
            {pendingImages.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {pendingImages.map((img, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #dde3ea", borderRadius: 4, padding: "4px 10px" }}>
                    <span style={{ fontSize: 11, color: "#555", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</span>
                    <button onClick={() => setPendingImages(p => p.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={onInput}
                onKeyDown={onKey}
                placeholder="Ask anything about the climate data..."
                rows={1}
                style={{ width: "100%", background: "transparent", border: "none", color: "#333", fontSize: 13, lineHeight: 1.6, padding: "12px 16px 8px", maxHeight: 120, overflowY: "auto", display: "block" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid #f0f0f0", background: "#fafbfc" }}>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
                <button
                  className="attach-btn"
                  onClick={() => fileRef.current?.click()}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: "4px", display: "flex", alignItems: "center", transition: "color .12s", borderRadius: 4 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.42 16.41a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {pendingImages.length > 0 && (
                  <span style={{ fontSize: 11, color: "#4caf50", fontWeight: 600 }}>{pendingImages.length} map{pendingImages.length > 1 ? "s" : ""} attached</span>
                )}

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#bbb" }}>AI can make mistakes. Verify important data.</span>
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={loading || (!input.trim() && !pendingImages.length)}
                    style={{ height: 30, padding: "0 14px", borderRadius: 4, background: "#003087", border: "none", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, flexShrink: 0, transition: "background .15s" }}
                  >
                    {loading
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round" /></svg>
                      : <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Send
                        </>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}