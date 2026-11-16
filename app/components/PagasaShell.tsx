"use client";

/* eslint-disable @next/next/no-img-element */
// The PAGASA site frame (GOVPH top bar, header with menu and clock, icon rail, sidebar) for the
// public Farm pages, so /farm and /farm/history look and navigate like the rest of the site.
// It matches the frame drawn inline in app/report/page.tsx. Sidebar entries link to the report
// page, which opens the matching panel from its ?panel= address.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import ReportFooter from "./ReportFooter";

export type ShellPage = "farm" | "history";

const NAV_ITEMS = ["WEATHER", "FLOOD", "TROPICAL CYCLONE", "CLIMATE", "AGRI-WEATHER", "ASTRONOMY", "REGIONAL FORECAST"];

const GOV_MOBILE_MENU: { label: string; icon?: string; caret?: boolean }[] = [
  { label: "Home" },
  { label: "Weather", icon: "02-weather", caret: true },
  { label: "Flood", icon: "03-flood", caret: true },
  { label: "Tropical Cyclone", icon: "04-cyclone", caret: true },
  { label: "Climate", icon: "05-climate", caret: true },
  { label: "Agri-Weather", icon: "06-agri", caret: true },
  { label: "Astronomy", icon: "07-astronomy", caret: true },
  { label: "Regional Forecast", icon: "09-layers", caret: true },
];

const RAIL_ICONS = [
  "01-menu", "02-weather", "03-flood", "04-cyclone", "05-climate", "06-agri", "07-astronomy",
  "08-hazard", "09-layers", "10-vacancy", "11-gender", "12-publications", "13-info",
];

const reportPanel = (panel: string) => `/report?${new URLSearchParams({ panel })}`;

// Same entries and order as the report page's sidebar. Corn is the report's default panel.
const SIDEBAR_GROUPS: { label: string; href: string }[][] = [
  [
    { label: "Corn Crop Stage and Water Sufficiency", href: "/report" },
    { label: "Rice Crop Stage and Water Sufficiency", href: reportPanel("cat:Rice Crop Stage and Water Sufficiency") },
  ],
  [{ label: "Monthly Rainfall", href: reportPanel("cat:Monthly Rainfall") }],
  [{ label: "Tropical Cyclone", href: reportPanel("cat:Tropical Cyclone") }],
  [{ label: "Crop Condition and Drought Indicator", href: reportPanel("cat:Crop Condition and Drought Indicator") }],
  [{ label: "Regions", href: reportPanel("regions") }],
];

const FARM_LINKS: { id: ShellPage; label: string; href: string }[] = [
  { id: "farm", label: "Farm Weather and Planting Guide", href: "/farm" },
  { id: "history", label: "Historical Climate Data", href: "/farm/history" },
];

const CSS = `
  .pgs-root *, .pgs-root *::before, .pgs-root *::after { box-sizing: border-box; }
  .pgs-gov-label, .pgs-gov-toggle, .pgs-gov-menu, .pgs-gov-backdrop, .pgs-menu-btn, .pgs-overlay { display: none; }
  .pgs-topbar { position: relative; z-index: 80; }
  .pgs-link:hover, .pgs-link:focus-visible { text-decoration: underline; }

  @media (max-width: 1100px) {
    .pgs-extra, .pgs-search, .pgs-nav, .pgs-clock { display: none !important; }
    .pgs-topbar { padding-left: 16px !important; padding-right: 16px !important; }
    .pgs-header { padding: 8px 16px !important; }
    .pgs-rail { width: 46px !important; }
    .pgs-side { width: 170px !important; padding-left: 14px !important; padding-right: 14px !important; }
  }

  @media (max-width: 760px), (hover: none) and (pointer: coarse) and (max-width: 1100px) {
    .pgs-topbar { min-height: 38px; padding: 5px 12px !important; }
    .pgs-header { min-height: 68px; padding: 7px 12px !important; gap: 10px !important; }
    .pgs-logo { width: 48px !important; height: 48px !important; }
    .pgs-header-copy { min-width: 0; flex: 1; }
    .pgs-header-dept { font-size: 9px !important; }
    .pgs-header-name { font-size: 12px !important; line-height: 1.15 !important; }
    .pgs-header-name br { display: none; }
    .pgs-gov-label { display: block; font-weight: 700; font-size: 14px; letter-spacing: .02em; color: #fff; }
    .pgs-gov-toggle {
      display: inline-flex; align-items: center; justify-content: center; margin-left: auto; width: 38px; height: 30px;
      border: 1px solid rgba(255,255,255,.55); border-radius: 4px; background: transparent; color: #fff; cursor: pointer; font-size: 18px; line-height: 1;
    }
    .pgs-gov-backdrop.open { display: block; position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.25); }
    .pgs-gov-menu.open {
      display: block; position: absolute; top: 100%; left: 0; right: 0; z-index: 90; background: #1c2b3a;
      border-top: 1px solid rgba(255,255,255,.12); box-shadow: 0 12px 24px rgba(0,0,0,.35); max-height: calc(100dvh - 60px); overflow-y: auto;
    }
    .pgs-gov-menu button {
      display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 18px; border: 0;
      border-bottom: 1px solid rgba(255,255,255,.08); background: transparent; color: #fff; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer;
    }
    .pgs-gov-menu img { display: block; width: 22px; height: 22px; flex-shrink: 0; }
    .pgs-menu-btn {
      display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0;
      border: 1px solid #d8dde5; border-radius: 6px; background: #fff; color: #282a35; cursor: pointer; font-size: 21px;
    }
    .pgs-rail, .pgs-side { display: none !important; }
    .pgs-side.open {
      display: flex !important; position: fixed; z-index: 60; top: 106px; bottom: 0; left: 0; width: min(320px, 88vw) !important;
      padding: 24px 20px 90px !important; border-top: 1px solid rgba(255,255,255,.12); box-shadow: 8px 0 24px rgba(0,0,0,.24);
    }
    .pgs-side.open a { min-height: 36px; font-size: 15px !important; padding: 8px 10px !important; border-radius: 4px; }
    .pgs-overlay.open { display: block; position: fixed; z-index: 55; top: 106px; right: 0; bottom: 0; left: 0; background: rgba(0,0,0,.35); border: 0; }
  }

  /* Printing (the history page's "Print / Save as PDF"): only the page content and the PAGASA name remain. */
  @media print {
    .pgs-hide-print, .pgs-nav, .pgs-clock { display: none !important; }
    html, body { height: auto !important; overflow: visible !important; }
    .pgs-root { display: block !important; height: auto !important; overflow: visible !important; }
    .pgs-body { display: block !important; }
    .pgs-main { overflow: visible !important; }
  }
`;

export default function PagasaShell({ active, children }: { active: ShellPage; children: ReactNode }) {
  const [govOpen, setGovOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(first); clearInterval(tick); };
  }, []);

  const timeStr = now ? now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--:--:--";
  const dateStr = now ? now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";

  const sideLink = (on: boolean) => ({
    color: on ? "#fff" : "#e4e7ec",
    fontWeight: on ? 700 : 400,
    fontSize: 13,
    lineHeight: 1.4,
    textDecoration: "none",
    display: "block",
  } as const);
  const dim = { opacity: 0.85, cursor: "pointer" } as const;

  return (
    <div className="pgs-root" style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", fontFamily: "Arial, Helvetica, sans-serif", color: "#222" }}>
      <style>{CSS}</style>

      {/* GOVPH top bar */}
      <div className="pgs-topbar pgs-hide-print" style={{ background: "#282a35", color: "#fff", padding: "8px 24px", display: "flex", alignItems: "center", gap: 16, fontSize: 13, flexShrink: 0 }}>
        <img src="/govph-seal.png" alt="Republic of the Philippines seal" width={30} height={32} style={{ display: "block", flexShrink: 0 }} />
        <div className="pgs-gov-label">GOVPH</div>
        <button type="button" className="pgs-gov-toggle" aria-label={govOpen ? "Close GOVPH menu" : "Open GOVPH menu"} aria-expanded={govOpen} onClick={() => setGovOpen(o => !o)}>
          {govOpen ? "✕" : "☰"}
        </button>
        <span className="pgs-extra" style={{ fontWeight: 700, letterSpacing: ".02em" }}>GOVPH</span>
        <Link href="/report" className="pgs-extra pgs-link" style={{ color: "inherit", textDecoration: "none", opacity: 0.85 }}>Home</Link>
        <span className="pgs-extra" style={dim}>Transparency Seal ▾</span>
        <span className="pgs-extra" style={dim}>Product and Services</span>
        <div className="pgs-extra" style={{ marginLeft: "auto", display: "flex", gap: 16, opacity: 0.85 }}>
          <span style={{ cursor: "pointer" }}>Privacy Notice</span>
          <span style={{ cursor: "pointer" }}>Accessibility</span>
          <span style={{ cursor: "pointer" }}>Contact Us</span>
        </div>
        <input className="pgs-search" placeholder="Search PAGASA Website" aria-label="Search PAGASA Website" readOnly
          style={{ background: "#fff", border: "none", borderRadius: 3, padding: "5px 10px", color: "#333", fontSize: 12, width: 170 }} />

        <div className={`pgs-gov-backdrop${govOpen ? " open" : ""}`} onClick={() => setGovOpen(false)} />
        <div className={`pgs-gov-menu${govOpen ? " open" : ""}`} role="menu">
          {GOV_MOBILE_MENU.map(item => (
            <button key={item.label} type="button" role="menuitem" onClick={() => setGovOpen(false)}>
              <span>{item.label}{item.caret ? <span style={{ opacity: 0.7, marginLeft: 4, fontSize: 10 }}>▾</span> : null}</span>
              {item.icon ? <img src={`/rail-icons/${item.icon}.png`} alt="" width={22} height={22} draggable={false} /> : null}
            </button>
          ))}
        </div>
      </div>

      {/* PAGASA header */}
      <div className="pgs-header" style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <img src="/pagasa-logo.png" alt="PAGASA logo" className="pgs-logo" width={56} height={56} style={{ display: "block", flexShrink: 0 }} />
        <div className="pgs-header-copy">
          <div className="pgs-header-dept" style={{ fontSize: 11, color: "#555" }}>Department of Science and Technology</div>
          <div className="pgs-header-name" style={{ fontSize: 15, fontWeight: 700, color: "#111", lineHeight: 1.25 }}>
            Philippine Atmospheric, Geophysical and{" "}<br />Astronomical Services Administration
          </div>
        </div>
        <nav className="pgs-nav" aria-label="PAGASA sections" style={{ marginLeft: "auto", display: "flex", gap: 18, fontSize: 12, fontWeight: 700, color: "#222" }}>
          {NAV_ITEMS.map(n => <span key={n} style={{ cursor: "pointer", whiteSpace: "nowrap" }}>{n} ▾</span>)}
        </nav>
        <div className="pgs-clock" style={{ border: "1px solid #d32f2f", borderRadius: 3, padding: "4px 10px", fontSize: 10, color: "#d32f2f", textAlign: "center", lineHeight: 1.4, marginLeft: 14 }}>
          Philippines Standard Time<br /><strong>{timeStr}</strong><br />{dateStr}
        </div>
        <button type="button" className="pgs-menu-btn pgs-hide-print" aria-label={sideOpen ? "Close menu" : "Open menu"} aria-expanded={sideOpen} onClick={() => setSideOpen(o => !o)}>
          {sideOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Body: icon rail, sidebar, page */}
      <div className="pgs-body" style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
        <div className="pgs-rail pgs-hide-print" style={{ width: 52, background: "#282a35", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 13, overflowY: "auto", flexShrink: 0 }}>
          {RAIL_ICONS.map(name => (
            <img key={name} src={`/rail-icons/${name}.png`} alt="" width={26} height={26} draggable={false} style={{ display: "block", flexShrink: 0 }} />
          ))}
        </div>

        <nav aria-label="Report and farm pages" className={`pgs-side pgs-hide-print${sideOpen ? " open" : ""}`}
          style={{ width: 190, background: "#3b3f52", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", flexShrink: 0 }}>
          {SIDEBAR_GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {group.map(l => (
                <Link key={l.label} href={l.href} onClick={() => setSideOpen(false)} className="pgs-link" style={sideLink(false)}>{l.label}</Link>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid #5a5f75", paddingTop: 14 }}>
            {FARM_LINKS.map(l => (
              <Link key={l.id} href={l.href} onClick={() => setSideOpen(false)} aria-current={active === l.id ? "page" : undefined} className="pgs-link" style={sideLink(active === l.id)}>{l.label}</Link>
            ))}
          </div>
        </nav>

        <button type="button" className={`pgs-overlay pgs-hide-print${sideOpen ? " open" : ""}`} aria-label="Close menu" onClick={() => setSideOpen(false)} />

        <div className="pgs-main" style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "#f2f4f7", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>{children}</div>
          <div className="pgs-hide-print"><ReportFooter /></div>
        </div>
      </div>
    </div>
  );
}
