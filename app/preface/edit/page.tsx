"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { savePreface, getPreface, type PrefaceBlock } from "../../lib/reportStore";
import AuditLogNav from "../../components/AuditLogNav";
import UserMenu from "@/app/components/UserMenu";
import ZoomableImage from "@/app/components/ZoomableImage";


const toBase64File = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string); // full data URL, incl. "data:image/...;base64,"
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

const makeId = () => Math.random().toString(36).slice(2, 10);

export default function PrefaceEditPage() {
  const router = useRouter();

  const [blocks, setBlocks] = useState<PrefaceBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  // key = block id, so each image block gets its own <input type="file">
  const imageRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load whatever Preface content is already saved, so the form shows current state.
  useEffect(() => {
    const existing = getPreface();
    if (existing && existing.blocks.length) setBlocks(existing.blocks);
  }, []);

  const addTextBlock = useCallback(() => {
    setSaved(false);
    setBlocks(prev => [...prev, { id: makeId(), type: "text", content: "" }]);
  }, []);

  const addImageBlock = useCallback(() => {
    setSaved(false);
    setBlocks(prev => [...prev, { id: makeId(), type: "image", content: "" }]);
  }, []);

  const updateTextBlock = useCallback((id: string, value: string) => {
    setSaved(false);
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, content: value } : b)));
  }, []);

  const handleImageChoose = useCallback(async (id: string, files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setSaved(false);
    try {
      const dataUrl = await toBase64File(file);
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, content: dataUrl } : b)));
    } catch {
      setError("Something went wrong reading that image.");
    }
  }, []);

  const removeBlock = useCallback((id: string) => {
    setSaved(false);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setSaved(false);
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (blocks.length === 0) {
      setError("Add at least one text or image block.");
      return;
    }
    const emptyImage = blocks.find(b => b.type === "image" && !b.content);
    if (emptyImage) {
      setError("One of your image blocks has no image chosen yet.");
      return;
    }
    setError(null);

    try {
        await savePreface(blocks);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setError("Something went wrong saving the Preface.");
    }
  };

  const impactChildren = ["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"];

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

        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; border-right: none; background: transparent; width: 100%; text-align: left; font-family: inherit; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; user-select:none; }
        .side-parent:hover { background:#e8edf2; }

        input[type=file]::file-selector-button {
          background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 4px;
          padding: 3px 10px; cursor: pointer; font-size: 13px; color: #374151; margin-right: 8px;
        }
        textarea.block-textarea {
          width: 100%; border: 1px solid #dde3ea; border-radius: 4px; padding: 8px 10px;
          font-size: 13px; font-family: inherit; color: #333; resize: vertical; min-height: 70px;
        }
        textarea.block-textarea:focus { outline: none; border-color: #003087; }
        .btn-save:hover:not(:disabled) { background: #1d4ed8 !important; }
        .btn-add:hover { background: #e8edf2 !important; }
        .btn-icon:hover { background: #e8edf2 !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none} }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200, background: "#fff", borderRight: "1px solid #dde3ea",
        display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
      }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        <nav style={{ flex: 1, paddingTop: 6 }}>
          <div className="side-parent" onClick={() => setMaintenanceOpen(p => !p)}>
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {maintenanceOpen && ["Dashboard", "Users", "Settings"].map(label => (
            <button key={label} className="side-link" onClick={() => {}}>{label}</button>
          ))}

          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && impactChildren.map(label => (
            <button
              key={label}
              className={`side-link${label === "Preface" ? " active" : ""}`}
              onClick={() => {
                if (label === "Preface") return;
                if (label === "Corn Crop Stage and Water Sufficiency") { router.push("/corn-crop-stage/edit"); return; }
                if (label === "Rice Crop Stage and Water Sufficiency") { router.push("/rice-crop-stage/edit"); return; }
                if (label === "Monthly Rainfall") { router.push("/monthly-rainfall/edit"); return; }
                if (label === "Tropical Cyclone") { router.push("/tropical-cyclone/edit"); return; }
                if (label === "Crop Condition and Drought Indicator") { router.push("/crop-condition-drought/edit"); return; }
                if (label === "Cover Page") { router.push("/cover-page/edit"); return; }
                if (label === "About this Report") { router.push("/about-this-report/edit"); return; }
                if (label === "Overview") { router.push("/overview/edit"); return; }
                router.push("/");
              }}
            >{label}</button>
          ))}

          <AuditLogNav />
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <button
              className="side-link"
              style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => router.push("/chat")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </button>
          </div>
        </nav>

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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
          <UserMenu />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 32px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Impact Assessment</h1>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Preface</div>

          {/* ── Update Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden", maxWidth: 640 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>Update</span>
              <button
                className="btn-save"
                onClick={handleSave}
                style={{
                  background: saved ? "#16a34a" : "#003087",
                  color: "#fff", border: "none", borderRadius: 4,
                  width: 36, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "background .15s",
                }}
                aria-label="Save"
              >
                {saved ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            </div>

            <div style={{ padding: "18px 16px" }}>
              <p style={{ color: "#888", fontSize: 12, margin: "0 0 14px" }}>
                Build the Preface by stacking text and image blocks in any order — text, text, image, text, image, and so on. Use the arrows to reorder.
              </p>

              <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 10, color: "#374151" }}>
                Content Blocks
              </label>

              {blocks.length === 0 && (
                <div style={{ fontSize: 13, color: "#999", padding: "14px 0", textAlign: "center", border: "1px dashed #dde3ea", borderRadius: 5 }}>
                  No blocks yet. Add a text or image block below.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {blocks.map((block, i) => (
                  <div
                    key={block.id}
                    style={{
                      border: "1px solid #dde3ea", borderRadius: 5, padding: 12,
                      background: "#fafbfc", animation: "fadeIn .2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#003087", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {i + 1}. {block.type === "text" ? "Text" : "Image"}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="btn-icon"
                          onClick={() => moveBlock(block.id, -1)}
                          disabled={i === 0}
                          title="Move up"
                          style={iconBtnStyle(i === 0)}
                        >↑</button>
                        <button
                          className="btn-icon"
                          onClick={() => moveBlock(block.id, 1)}
                          disabled={i === blocks.length - 1}
                          title="Move down"
                          style={iconBtnStyle(i === blocks.length - 1)}
                        >↓</button>
                        <button
                          className="btn-icon"
                          onClick={() => removeBlock(block.id)}
                          title="Remove block"
                          style={iconBtnStyle(false, true)}
                        >✕</button>
                      </div>
                    </div>

                    {block.type === "text" ? (
                      <textarea
                        className="block-textarea"
                        placeholder="Write a paragraph of Preface text…"
                        value={block.content}
                        onChange={e => updateTextBlock(block.id, e.target.value)}
                      />
                    ) : (
                      <div>
                        <input
                          ref={el => { imageRefs.current[block.id] = el; }}
                          type="file"
                          accept="image/*"
                          onChange={e => handleImageChoose(block.id, e.target.files)}
                          style={{ width: "100%", border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }}
                        />
                        {block.content && (
                          <ZoomableImage
                            src={block.content}
                            alt={`Preface image ${i + 1}`}
                            style={{ marginTop: 10, width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 5, border: "1px solid #dde3ea", display: "block" }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn-add" onClick={addTextBlock} style={addBtnStyle}>+ Add Text</button>
                <button className="btn-add" onClick={addImageBlock} style={addBtnStyle}>+ Add Image</button>
              </div>

              {error && (
                <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 5, padding: "9px 12px", fontSize: 13, color: "#d32f2f", marginTop: 14 }}>
                  ⚠ {error}
                </div>
              )}
              {saved && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 14, fontWeight: 600 }}>
                  ✓ Preface saved
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => router.push("/")}
              style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
            >
              ← Back to Impact Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean, danger?: boolean): CSSProperties {
  return {
    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, border: "1px solid #dde3ea", borderRadius: 4,
    background: "#fff", cursor: disabled ? "default" : "pointer",
    color: disabled ? "#ccc" : danger ? "#d32f2f" : "#555",
    opacity: disabled ? 0.5 : 1,
  };
}

const addBtnStyle: CSSProperties = {
  background: "#fff", border: "1px solid #dde3ea", color: "#003087",
  borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600,
};
