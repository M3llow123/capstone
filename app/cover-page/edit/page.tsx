"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveCoverImage, getCoverImage } from "../../lib/reportStore";
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

export default function CoverPageEditPage() {
  const router = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const imageRef = useRef<HTMLInputElement>(null);

  // Load whatever cover image is already saved, so the form shows current state.
  useEffect(() => {
    const existing = getCoverImage();
    if (existing) setImagePreview(existing.image);
  }, []);

  const handleImage = useCallback((files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setSaved(false);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    if (imageRef.current) imageRef.current.value = "";
  }, []);

  const handleSave = async () => {
    if (!imageFile && !imagePreview) {
      setError("Displayed Image is required.");
      return;
    }
    setError(null);

    try {
      const dataUrl = imageFile ? await toBase64File(imageFile) : imagePreview!;
        await saveCoverImage(dataUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setError("Something went wrong saving the image.");
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
        .btn-save:hover:not(:disabled) { background: #1d4ed8 !important; }
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
              className={`side-link${label === "Cover Page" ? " active" : ""}`}
              onClick={() => {
                if (label === "Cover Page") return;
                if (label === "Corn Crop Stage and Water Sufficiency") { router.push("/corn-crop-stage/edit"); return; }
                if (label === "Rice Crop Stage and Water Sufficiency") { router.push("/rice-crop-stage/edit"); return; }
                if (label === "Monthly Rainfall") { router.push("/monthly-rainfall/edit"); return; }
                if (label === "Tropical Cyclone") { router.push("/tropical-cyclone/edit"); return; }
                if (label === "Crop Condition and Drought Indicator") { router.push("/crop-condition-drought/edit"); return; }
                if (label === "About this Report") { router.push("/about-this-report/edit"); return; }
                if (label === "Preface") { router.push("/preface/edit"); return; }
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
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Cover Page</div>

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
              <p style={{ color: "#d32f2f", fontSize: 12, margin: "0 0 14px" }}>* Required Field</p>

              <div>
                <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                  <span style={{ color: "#d32f2f" }}>* </span>Displayed Image
                </label>
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleImage(e.target.files)}
                  style={{ width: "100%", maxWidth: 380, border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }}
                />

                {imagePreview && (
                  <div style={{ marginTop: 12, animation: "fadeIn .2s ease" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>Preview</div>
                    <ZoomableImage
                      src={imagePreview}
                      alt="Cover page preview"
                      style={{ width: "100%", maxWidth: 380, maxHeight: 220, objectFit: "cover", borderRadius: 5, border: "1px solid #dde3ea", display: "block" }}
                    />
                  </div>
                )}
              </div>

              {error && (
                <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 5, padding: "9px 12px", fontSize: 13, color: "#d32f2f", marginTop: 14 }}>
                  ⚠ {error}
                </div>
              )}
              {saved && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 14, fontWeight: 600 }}>
                  ✓ Cover image saved
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
