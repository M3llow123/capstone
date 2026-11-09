"use client";

import { Suspense, useEffect, useState } from "react";
import ReportFooter from "../components/ReportFooter";
import { useSearchParams } from "next/navigation";

import { ChevronUp, ChevronDown } from "lucide-react";

import {
  onRegionReportsChanged,
  getRegionReport,
  getCoverImage,
  onCoverImageChanged,
  getAboutImage,
  onAboutImageChanged,
  getPreface,
  onPrefaceChanged,
  getOverview,
  onOverviewChanged,
  getCornImage,
  onCornImageChanged,
  getRiceImage,
  onRiceImageChanged,
  getRainfallImage,
  onRainfallImageChanged,
  getCycloneImage,
  onCycloneImageChanged,
  getDroughtImage,
  onDroughtImageChanged,
  type RegionReport,
} from "../lib/reportStore";

import RegionReportPanel from "../components/RegionReportViewer";
import ZoomableImage from "../components/ZoomableImage";

const TABS = [
  "Cover Page",
  "About this Report",
  "Preface",
  "Overview",
] as const;

type Tab = (typeof TABS)[number];

const NAV_ITEMS = [
  "WEATHER",
  "FLOOD",
  "TROPICAL CYCLONE",
  "CLIMATE",
  "AGRI-WEATHER",
  "ASTRONOMY",
  "REGIONAL FORECAST",
];

// Mobile menu (same list and look as the PAGASA website's mobile "GOVPH" menu).
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

// Icons copied from the PAGASA website sidebar: menu, weather, flood, tropical cyclone, climate,
// agri-weather, astronomy, hazards, products, vacancy, gender and development, publications, about.
const RAIL_ICONS = [
  "01-menu", "02-weather", "03-flood", "04-cyclone", "05-climate", "06-agri", "07-astronomy",
  "08-hazard", "09-layers", "10-vacancy", "11-gender", "12-publications", "13-info",
];

const SIDEBAR_GROUPS: string[][] = [
  [
    "Corn Crop Stage and Water Sufficiency",
    "Rice Crop Stage and Water Sufficiency",
  ],
  ["Monthly Rainfall"],
  ["Tropical Cyclone"],
  ["Crop Condition and Drought Indicator"],
];

// Each sidebar category above maps to its own single-image uploader in the
// CMS (same concept as the Cover Page uploader). Clicking a category on the
// public site shows whatever image was uploaded for it, in the same panel
// used for a clicked Region's report.
const CATEGORY_STORE: Record<
  string,
  { get: () => { image: string } | null; onChange: (cb: () => void) => () => void }
> = {
  "Corn Crop Stage and Water Sufficiency": { get: getCornImage, onChange: onCornImageChanged },
  "Rice Crop Stage and Water Sufficiency": { get: getRiceImage, onChange: onRiceImageChanged },
  "Monthly Rainfall": { get: getRainfallImage, onChange: onRainfallImageChanged },
  "Tropical Cyclone": { get: getCycloneImage, onChange: onCycloneImageChanged },
  "Crop Condition and Drought Indicator": { get: getDroughtImage, onChange: onDroughtImageChanged },
};

const REGIONS_LIST: { id: string; name: string }[] = [
  { id: "1", name: "Region 1 Ilocos Region" },
  { id: "2", name: "Region 2 Cagayan Valley" },
  { id: "3", name: "Cordillera Administrative Region" },
  { id: "4", name: "Region 3 Central Luzon" },
  { id: "5", name: "Region 4A CALABARZON" },
  { id: "6", name: "Region 4B MIMAROPA" },
  { id: "7", name: "Region 5 Bicol Region" },
  { id: "8", name: "Region 6 Western Visayas" },
  { id: "9", name: "Region 7 Central Visayas" },
  { id: "10", name: "Region 8 Eastern Visayas" },
  { id: "11", name: "Region 9 Zamboanga Peninsula" },
  { id: "12", name: "Region 10 Northern Mindanao" },
  { id: "13", name: "Region 11 Davao Region" },
  { id: "14", name: "Region 12 SOCCSKSARGEN" },
  { id: "15", name: "Region 13 CARAGA" },
  { id: "16", name: "BARMM" },
];

// Shared position for the floating panels (Regions list, region report,
// category image). They are pinned to the right edge of the main area, and
// the page content is given matching right-hand space while a panel is open
// (see `reservedWidth` below), so the panel never covers the content.
const FLOATING_PANEL_POSITION = {
  position: "absolute",
  top: 108,
  right: 24,
} as const;

// Never wider than the main area on small screens.
const FLOATING_PANEL_FIT = {
  maxWidth: "calc(100% - 48px)",
} as const;

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageInner />
    </Suspense>
  );
}

function ReportPageInner() {
  const searchParams = useSearchParams();

  const initialTab =
    (searchParams?.get("tab") as Tab) ?? "Cover Page";

  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.includes(initialTab) ? initialTab : "Cover Page"
  );

  const [govMenuOpen, setGovMenuOpen] = useState(false);

  const [regionsPanelOpen, setRegionsPanelOpen] =
    useState(false);

  const [regionsListOpen, setRegionsListOpen] =
    useState(false);

  const [selectedRegionId, setSelectedRegionId] =
    useState<string | null>(null);

  const [selectedRegionReport, setSelectedRegionReport] =
    useState<RegionReport | null>(null);

  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);

  const [selectedCategoryImage, setSelectedCategoryImage] =
    useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // On phones the region report, the Regions list and the other menu panels sit below the
  // cover page, so bring them into view once something has been chosen (otherwise it would
  // look like nothing happened).
  const scrollToRegionPanel = () => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    window.setTimeout(() => {
      document
        .querySelector(
          ".report-region-panel, .report-regions-picker, .report-category-panel"
        )
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const [now, setNow] = useState<Date | null>(null);

  /* =========================================
     SELECTED REGION REPORT
  ========================================= */

  useEffect(() => {
    if (!selectedRegionId) {
      const timeoutId = window.setTimeout(() => {
        setSelectedRegionReport(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const refresh = () => {
      setSelectedRegionReport(
        getRegionReport(selectedRegionId)
      );
    };

    refresh();

    return onRegionReportsChanged(refresh);
  }, [selectedRegionId]);

  /* =========================================
     SELECTED CATEGORY IMAGE
     (Corn / Rice / Monthly Rainfall / Tropical
     Cyclone / Crop Condition and Drought)
  ========================================= */

  useEffect(() => {
    const store = selectedCategory ? CATEGORY_STORE[selectedCategory] : null;

    if (!store) {
      const timeoutId = window.setTimeout(() => {
        setSelectedCategoryImage(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const refresh = () => {
      setSelectedCategoryImage(store.get()?.image ?? null);
    };

    refresh();

    return store.onChange(refresh);
  }, [selectedCategory]);

  /* =========================================
     CLOCK
  ========================================= */

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
    };

    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const timeStr = now
    ? now.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  const dateStr = now
    ? now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  // Width of whichever floating panel is currently showing, so the page
  // content can make room for it instead of sitting underneath it.
  const reservedWidth = regionsPanelOpen
    ? 210
    : selectedRegionId
      ? 620
      : selectedCategory
        ? 452
        : 0;

  return (
    <div
      className="report-page"
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#ffffff",
        fontFamily:
          "Arial, Helvetica, sans-serif",
        color: "#222",
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        .govph-topbar,
        .pagasa-header,
        .report-body,
        .report-main,
        .report-tabs {
          width: 100%;
        }

        .mobile-menu-button,
        .mobile-menu-overlay {
          display: none;
        }

        .region-item {
          background: #c3c8da;
          color: #1c2b3a;
        }

        .region-item:hover {
          background: #1c2b3a;
          color: #ffffff;
        }

        /* PAGASA-style mobile menu: hidden on desktop, shown at <= 760px */
        .govph-topbar {
          position: relative;
          z-index: 80;
        }
        .govph-mobile-label,
        .govph-mobile-toggle,
        .govph-mobile-menu,
        .govph-mobile-backdrop {
          display: none;
        }

        @media (max-width: 1100px) {
          .govph-extra,
          .govph-search,
          .pagasa-nav,
          .pagasa-clock {
            display: none !important;
          }

          .govph-topbar {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .pagasa-header {
            padding: 8px 16px !important;
          }

          .icon-rail {
            width: 46px !important;
          }

          .report-secondary {
            width: 170px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
          }

          .report-tabs {
            overflow-x: auto;
          }
        }

        @media (max-width: 760px) {
          html,
          body {
            overflow: hidden;
            height: 100%;
            width: 100%;
          }

          .report-page {
            width: 100vw !important;
            height: 100dvh !important;
          }

          .govph-topbar {
            min-height: 38px;
            padding: 5px 12px !important;
          }

          .govph-topbar > span:not(:first-of-type),
          .pagasa-clock,
          div.pagasa-clock {
            display: none !important;
          }

          .pagasa-header {
            min-height: 68px;
            padding: 7px 12px !important;
            gap: 10px !important;
          }

          .pagasa-header .pagasa-clock {
            position: absolute;
            display: none !important;
          }

          .pagasa-header-logo {
            width: 48px !important;
            height: 48px !important;
          }

          .pagasa-header-copy {
            min-width: 0;
            flex: 1;
          }

          .pagasa-header-department {
            font-size: 9px !important;
          }

          .pagasa-header-name {
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .pagasa-header-name br {
            display: none;
          }

          .govph-mobile-label {
            display: block;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: .02em;
            color: #fff;
          }

          .govph-mobile-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            width: 38px;
            height: 30px;
            border: 1px solid rgba(255, 255, 255, .55);
            border-radius: 4px;
            background: transparent;
            color: #fff;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
          }

          .govph-mobile-backdrop.open {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 70;
            background: rgba(0, 0, 0, .25);
          }

          .govph-mobile-menu.open {
            display: block;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 90;
            background: #1c2b3a;
            border-top: 1px solid rgba(255, 255, 255, .12);
            box-shadow: 0 12px 24px rgba(0, 0, 0, .35);
            max-height: calc(100dvh - 60px);
            overflow-y: auto;
          }

          .govph-mobile-menu button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 12px 18px;
            border: 0;
            border-bottom: 1px solid rgba(255, 255, 255, .08);
            background: transparent;
            color: #fff;
            font-size: 13px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
          }

          .govph-mobile-menu button:active {
            background: #263a4f;
          }

          .govph-mobile-menu img {
            display: block;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
          }

          .mobile-menu-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            flex-shrink: 0;
            border: 1px solid #d8dde5;
            border-radius: 6px;
            background: #fff;
            color: #282a35;
            cursor: pointer;
            font-size: 21px;
          }

          .icon-rail,
          .report-secondary {
            display: none !important;
          }

          .report-secondary.mobile-open {
            display: flex !important;
            position: fixed;
            z-index: 60;
            top: 106px;
            bottom: 0;
            left: 0;
            width: min(320px, 88vw) !important;
            padding: 24px 20px 90px !important;
            border-top: 1px solid rgba(255,255,255,.12);
            box-shadow: 8px 0 24px rgba(0, 0, 0, .24);
          }

          .report-secondary.mobile-open button {
            min-height: 36px;
            font-size: 15px !important;
            line-height: 1.35 !important;
            padding: 8px 10px !important;
            border-radius: 4px;
          }

          .report-secondary.mobile-open button:hover,
          .report-secondary.mobile-open button:focus-visible {
            background: rgba(255,255,255,.1) !important;
          }

          .report-secondary.mobile-open > div {
            gap: 8px !important;
          }

          .mobile-menu-overlay.open {
            display: block;
            position: fixed;
            z-index: 55;
            top: 106px;
            right: 0;
            bottom: 0;
            left: 0;
            background: rgba(0, 0, 0, .35);
          }

          .report-main {
            overflow-x: hidden;
          }

          .report-main img,
          .report-main canvas,
          .report-main table,
          .report-main video {
            max-width: 100%;
          }

          .report-main,
          .report-body {
            min-width: 0;
          }

          .report-tabs {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .report-tab-content {
            padding: 12px !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          .report-cover {
            min-height: 520px !important;
          }

          .report-cover-header,
          .report-cover-title-row {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .report-cover-title-row {
            gap: 12px !important;
          }

          .report-cover-title-row > div:first-child {
            flex-basis: 100% !important;
          }

          .report-cover-title-row {
            flex-direction: column !important;
          }

          .report-cover-title {
            font-size: clamp(25px, 8vw, 34px) !important;
          }

          .report-cover-subtitle {
            font-size: clamp(16px, 5vw, 22px) !important;
          }

          .report-section-card {
            padding: 16px !important;
          }

          .report-floating-panel {
            position: fixed !important;
            top: 114px !important;
            right: 12px !important;
            left: 12px !important;
            width: auto !important;
            max-width: none !important;
            max-height: calc(100dvh - 126px);
            overflow-y: auto !important;
          }

          .report-floating-panel > div {
            max-height: calc(100dvh - 180px) !important;
          }

          .report-region-panel,
          .report-regions-picker,
          .report-category-panel {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            left: auto !important;
            width: calc(100% - 24px) !important;
            max-width: none !important;
            max-height: none !important;
            margin: 12px !important;
            overflow: visible !important;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .12) !important;
            z-index: 1 !important;
          }

          /* Phones: show the cover page + tabs first, the region report below them,
             and keep the footer at the very bottom. */
          .report-region-panel,
          .report-regions-picker,
          .report-category-panel {
            order: 5 !important;
          }

          .report-main > :last-child {
            order: 10;
          }

          .report-region-panel .region-report-scroll {
            max-height: calc(100dvh - 230px) !important;
            border-top: 1px solid #eef1f5;
          }
        }
      `}</style>

      {/* =====================================
          GOVPH TOP BAR
      ====================================== */}

      <div
        className="govph-topbar"
        style={{
          background: "#282a35",
          color: "#fff",
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/govph-seal.png"
          alt="Republic of the Philippines seal"
          width={30}
          height={32}
          style={{ display: "block", flexShrink: 0 }}
        />

        <div className="govph-mobile-label">GOVPH</div>

        <button
          type="button"
          className="govph-mobile-toggle"
          aria-label={govMenuOpen ? "Close GOVPH menu" : "Open GOVPH menu"}
          aria-expanded={govMenuOpen}
          onClick={() => setGovMenuOpen((open) => !open)}
        >
          {govMenuOpen ? "✕" : "☰"}
        </button>

        <span
          className="govph-extra"
          style={{
            fontWeight: 700,
            letterSpacing: ".02em",
          }}
        >
          GOVPH
        </span>

        <span
          className="govph-extra"
          style={{
            opacity: 0.85,
            cursor: "pointer",
          }}
        >
          Home
        </span>

        <span
          style={{
            opacity: 0.85,
            cursor: "pointer",
          }}
        >
          Transparency Seal ▾
        </span>

        <span
          style={{
            opacity: 0.85,
            cursor: "pointer",
          }}
        >
          Product and Services
        </span>

        <div
          className="govph-extra"
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 16,
            opacity: 0.85,
          }}
        >
          <span style={{ cursor: "pointer" }}>
            Privacy Notice
          </span>

          <span style={{ cursor: "pointer" }}>
            Accessibility
          </span>

          <span style={{ cursor: "pointer" }}>
            Contact Us
          </span>
        </div>

        <input
          className="govph-search"
          placeholder="Search PAGASA Website"
          style={{
            background: "#fff",
            border: "none",
            borderRadius: 3,
            padding: "5px 10px",
            color: "#333",
            fontSize: 12,
            width: 170,
          }}
          readOnly
        />

        {/* PAGASA-style mobile menu (phones only) */}
        <div
          className={`govph-mobile-backdrop${govMenuOpen ? " open" : ""}`}
          onClick={() => setGovMenuOpen(false)}
        />
        <div className={`govph-mobile-menu${govMenuOpen ? " open" : ""}`} role="menu">
          {GOV_MOBILE_MENU.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => setGovMenuOpen(false)}
            >
              <span>
                {item.label}
                {item.caret ? <span style={{ opacity: 0.7, marginLeft: 4, fontSize: 10 }}>▾</span> : null}
              </span>
              {item.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/rail-icons/${item.icon}.png`} alt="" width={22} height={22} draggable={false} />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================
          PAGASA HEADER
      ====================================== */}

      <div
        className="pagasa-header"
        style={{
          background: "#fff",
          borderBottom: "1px solid #dde3ea",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pagasa-logo.png"
          alt="PAGASA logo"
          className="pagasa-header-logo"
          width={56}
          height={56}
          style={{ display: "block", flexShrink: 0 }}
        />

        <div className="pagasa-header-copy">
          <div
            style={{
              fontSize: 11,
              color: "#555",
            }}
            className="pagasa-header-department"
          >
            Department of Science and Technology
          </div>

          <div
            className="pagasa-header-name"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111",
              lineHeight: 1.25,
            }}
          >
            Philippine Atmospheric, Geophysical and
            <br />
            Astronomical Services Administration
          </div>
        </div>

        <nav
          className="pagasa-nav"
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 18,
            fontSize: 12,
            fontWeight: 700,
            color: "#222",
          }}
        >
          {NAV_ITEMS.map((n) => (
            <span
              key={n}
              style={{
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {n} ▾
            </span>
          ))}
        </nav>

        <div
          className="pagasa-clock"
          style={{
            border: "1px solid #d32f2f",
            borderRadius: 3,
            padding: "4px 10px",
            fontSize: 10,
            color: "#d32f2f",
            textAlign: "center",
            lineHeight: 1.4,
            marginLeft: 14,
          }}
        >
          Philippines Standard Time
          <br />

          <strong>{timeStr}</strong>
          <br />

          {dateStr}
        </div>

        <button
          type="button"
          className="mobile-menu-button"
          aria-label={mobileMenuOpen ? "Close report menu" : "Open report menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* =====================================
          BODY
      ====================================== */}

      <div
        className="report-body"
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ===================================
            ICON RAIL
        ==================================== */}

        <div
          className="icon-rail"
          style={{
            width: 52,
            background: "#282a35",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 14,
            gap: 13,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {RAIL_ICONS.map((name) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={name}
              src={`/rail-icons/${name}.png`}
              alt=""
              width={26}
              height={26}
              draggable={false}
              style={{ display: "block", flexShrink: 0 }}
            />
          ))}
        </div>

        {/* ===================================
            SECONDARY SIDEBAR
        ==================================== */}

        <div
          className={`report-secondary${mobileMenuOpen ? " mobile-open" : ""}`}
          style={{
            width: 190,
            background: "#3b3f52",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {SIDEBAR_GROUPS.map((group, gi) => (
            <div
              key={gi}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {group.map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    setSelectedCategory(
                      (previous) => (previous === label ? null : label)
                    );
                    setMobileMenuOpen(false);

                    setSelectedRegionId(null);
                    setRegionsPanelOpen(false);
                    setRegionsListOpen(false);
                    scrollToRegionPanel();
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    color:
                      selectedCategory === label ? "#fff" : "#e4e7ec",
                    fontWeight: selectedCategory === label ? 700 : 400,
                    fontSize: 13,
                    lineHeight: 1.4,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}

          {/* Regions button */}

          <button
            onClick={() => {
              setRegionsPanelOpen(
                (previous) => !previous
              );
              setMobileMenuOpen(false);

              setRegionsListOpen(false);
              setSelectedCategory(null);
              scrollToRegionPanel();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              background: "transparent",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: regionsPanelOpen ? "#fff" : "transparent",
              borderRadius: 3,
              padding: "6px 8px",
              margin: "-6px -8px 0",
              color: "#e4e7ec",
              fontSize: 13,
              lineHeight: 1.4,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Regions
          </button>
        </div>

        <button
          type="button"
          className={`mobile-menu-overlay${mobileMenuOpen ? " open" : ""}`}
          aria-label="Close report menu"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* ===================================
            MAIN CONTENT (only this scrolls)
        ==================================== */}

        <div
          className="report-main"
          style={{
            flex: 1,
            padding: 0,
            position: "relative",
            minWidth: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column", // lets the footer sit at the very bottom
          }}
        >
          {/* ===============================
              REGION DROPDOWN PANEL
          ================================ */}

          {regionsPanelOpen && (
            <div
              className="report-floating-panel report-regions-picker"
              style={{
                ...FLOATING_PANEL_POSITION,
                width: 210,
                zIndex: 20,
                boxShadow:
                  "0 6px 18px rgba(0,0,0,.18)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() =>
                  setRegionsListOpen(
                    (previous) => !previous
                  )
                }
                style={{
                  background: "#3b3f52",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Regions

                {regionsListOpen ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>

              {regionsListOpen && (
                <div
                  style={{
                    maxHeight: 380,
                    overflowY: "auto",
                  }}
                >
                  {REGIONS_LIST.map((region) => (
                    <button
                      key={region.id}
                      className="region-item"
                      onClick={() => {
                        setSelectedRegionId(
                          region.id
                        );

                        setRegionsPanelOpen(false);
                        setRegionsListOpen(false);
                        setSelectedCategory(null);
                        scrollToRegionPanel();
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderTop:
                          "1px solid rgba(255,255,255,.15)",
                        padding: "8px 14px",
                        fontSize: 12.5,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {region.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===============================
              SELECTED REGION REPORT
          ================================ */}

          {selectedRegionId &&
            !regionsPanelOpen && (
              <div
              className="report-floating-panel report-region-panel"
              style={{
                  ...FLOATING_PANEL_POSITION,
                  width: 620,
                  ...FLOATING_PANEL_FIT,
                  zIndex: 15,
                  boxShadow:
                    "0 6px 18px rgba(0,0,0,.18)",
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {/* Region report header */}

                <div
                  className="region-report-scroll"
                  style={{
                    background: "#3b3f52",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "9px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => {
                      setRegionsListOpen((open) => !open);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 0,
                      minWidth: 0,
                      maxWidth: "calc(100% - 30px)",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {REGIONS_LIST.find(
                        (region) => region.id === selectedRegionId
                      )?.name ?? "Regions"}
                    </span>
                    {regionsListOpen ? (
                      <ChevronUp size={14} style={{ flexShrink: 0 }} />
                    ) : (
                      <ChevronDown size={14} style={{ flexShrink: 0 }} />
                    )}
                  </button>

                  {regionsListOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        width: 210,
                        background: "#fff",
                        border: "1px solid #ccd4df",
                        boxShadow: "0 6px 18px rgba(0,0,0,.18)",
                        maxHeight: 380,
                        overflowY: "auto",
                        zIndex: 30,
                      }}
                    >
                      {REGIONS_LIST.map((region) => (
                        <button
                          key={region.id}
                          className="region-item"
                          onClick={() => {
                            setSelectedRegionId(region.id);
                            setRegionsListOpen(false);
                            scrollToRegionPanel();
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            borderBottom: "1px solid rgba(28,43,58,.12)",
                            padding: "9px 14px",
                            textAlign: "left",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                          }}
                        >
                          {region.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setSelectedRegionId(null)
                    }
                    aria-label="Close"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#c7d2dc",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Region document */}

                <div
                  style={{
                    maxHeight: "calc(100vh - 260px)",
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: 8,
                  }}
                >
                  {selectedRegionReport ? (
                    <RegionReportPanel
                      regionName={selectedRegionReport.name}
                      summary={selectedRegionReport.summary}
                      month={selectedRegionReport.month}
                      mapImage={selectedRegionReport.images?.[0] ?? null}
                      chart={selectedRegionReport.chart ?? null}
                    />
                  ) : (
                    <div
                      style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        color: "#888",
                        fontSize: 12.5,
                      }}
                    >
                      No finalized report for this
                      region yet.
                      <br />
                      Upload and generate one from
                      the CMS (Impact Assessment →
                      Regions), then click
                      &quot;Next&quot; to save it.
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* ===============================
              SELECTED CATEGORY REPORT
              (Corn / Rice / Monthly Rainfall /
              Tropical Cyclone / Crop Condition
              and Drought Indicator)
          ================================ */}

          {selectedCategory && (
            <div
              className="report-floating-panel report-category-panel"
              style={{
                ...FLOATING_PANEL_POSITION,
                width: 452,
                ...FLOATING_PANEL_FIT,
                zIndex: 15,
                boxShadow: "0 6px 18px rgba(0,0,0,.18)",
                borderRadius: 3,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {/* Header */}
              <div
                style={{
                  background: "#3b3f52",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span>{selectedCategory}</span>

                <button
                  onClick={() => setSelectedCategory(null)}
                  aria-label="Close"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#c7d2dc",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div
                style={{
                  maxHeight: 560,
                  overflowY: "auto",
                  padding: 8,
                }}
              >
                {selectedCategoryImage ? (
                  <ZoomableImage
                    src={selectedCategoryImage}
                    alt={selectedCategory}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      borderRadius: 2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: "24px 16px",
                      textAlign: "center",
                      color: "#888",
                      fontSize: 12.5,
                    }}
                  >
                    No image uploaded for this
                    category yet.
                    <br />
                    Upload one from the CMS
                    (Impact Assessment →{" "}
                    {selectedCategory}), and it
                    will appear here.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================
              BLUE PAGE TITLE
          ================================== */}

          <div
            style={{
              background: "#3f96cc",
              color: "#fff",
              padding: "13px 16px",
              margin: "10px 12px 0",
              borderRadius: 4,
              fontSize: 17,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            Climate Impact Assessment for Philippine Agriculture
          </div>

          {/* =================================
              TABS
          ================================== */}

          <div
            style={{
              display: "flex",
              padding: "14px 24px 0",
              gap: 0,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() =>
                  setActiveTab(tab)
                }
                style={{
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#111",
                  background: "#fff",
                  border:
                    "1px solid " +
                    (activeTab === tab
                      ? "#111"
                      : "transparent"),
                  marginBottom: -1,
                  cursor: "pointer",
                  borderRadius: 3,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* =================================
              TAB CONTENT
          ================================== */}

          <div
            className="report-tab-content"
            style={{
              padding: "24px",
              maxWidth: reservedWidth
                ? `min(940px, calc(100% - ${reservedWidth + 16}px))`
                : 940,
              width: "100%",
            }}
          >
            {activeTab === "Cover Page" && (
              <CoverPage now={now} />
            )}

            {activeTab ===
              "About this Report" && (
              <AboutThisReportSection />
            )}

            {activeTab === "Preface" && (
              <PrefaceSection />
            )}

            {activeTab === "Overview" && (
              <OverviewSection />
            )}
          </div>

          <ReportFooter />
        </div>
      </div>
    </div>
  );
}

/* =========================================
   PLACEHOLDER SECTION
========================================= */

function PlaceholderSection({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      className="report-cover"
      style={{
        background: "#fff",
        border: "1px solid #dde3ea",
        borderRadius: 4,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 10px",
          color: "#222",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#444",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/* =========================================
   ABOUT THIS REPORT
========================================= */

function AboutThisReportSection() {
  const [aboutImage, setAboutImage] =
    useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setAboutImage(
        getAboutImage()?.image ?? null
      );
    };

    refresh();

    return onAboutImageChanged(refresh);
  }, []);

  return (
    <div
      className="report-cover-header"
      style={{
        background: "#fff",
        border: "1px solid #dde3ea",
        borderRadius: 4,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 10px",
          color: "#222",
        }}
      >
        About this Report
      </h2>

      {aboutImage && (
        <div
          className="report-cover-title-row"
          style={{
            width: "100%",
            maxWidth: 700,
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <ZoomableImage
            src={aboutImage}
            alt="About this Report"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#444",
          margin: 0,
        }}
      >
        This report presents PAGASA&apos;s monthly assessment of climate conditions and their expected impact on rice and corn production across the Philippines&apos; agricultural regions.
      </p>
    </div>
  );
}

/* =========================================
   PREFACE
========================================= */

function PrefaceSection() {
  const [blocks, setBlocks] = useState<
    { id: string; type: "text" | "image"; content: string }[]
  >([]);

  useEffect(() => {
    const refresh = () => {
      setBlocks(getPreface()?.blocks ?? []);
    };

    refresh();

    return onPrefaceChanged(refresh);
  }, []);

  if (blocks.length === 0) {
    return (
      <PlaceholderSection
        title="Preface"
        text="This publication is produced by DOST-PAGASA to support informed agricultural planning by combining climate monitoring data with crop-stage and water-sufficiency indicators."
      />
    );
  }

  return (
    <div
      className="report-cover-title"
      style={{
        background: "#fff",
        border: "1px solid #dde3ea",
        borderRadius: 4,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 14px",
          color: "#222",
        }}
      >
        Preface
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {blocks.map(block =>
          block.type === "text" ? (
            <p
              key={block.id}
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "#444",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {block.content}
            </p>
          ) : (
            <div
              key={block.id}
              style={{
                width: "100%",
                maxWidth: 700,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <ZoomableImage
                src={block.content}
                alt="Preface"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================
   COVER PAGE
========================================= */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CoverPage(_props: { now: Date | null }) {
  const [coverImage, setCoverImage] =
    useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setCoverImage(
        getCoverImage()?.image ?? null
      );
    };

    refresh();

    return onCoverImageChanged(refresh);
  }, []);

  /* =======================================
     UPLOADED COVER IMAGE
  ======================================== */

  if (coverImage) {
    return (
      <div
        className="report-cover-subtitle"
        style={{
          width: "100%",
          maxWidth: 760,
          margin: 0,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <ZoomableImage
          src={coverImage}
          alt="Report cover"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  /* =======================================
     NOTHING UPLOADED YET
     (no default design is shown any more)
  ======================================== */

  return (
    <div
      role="status"
      style={{
        width: "100%",
        maxWidth: 760,
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: "#fff",
        border: "1px dashed #c3ccd6",
        borderRadius: 4,
        padding: 32,
        textAlign: "center",
        color: "#888",
        fontSize: 14,
        boxSizing: "border-box",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#aab4c0"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontWeight: 600, color: "#666" }}>
        No cover page has been uploaded yet.
      </div>
      <div>
        Add one from the CMS (Impact Assessment → Cover Page) and it will
        appear here.
      </div>
    </div>
  );
}

/* =========================================
   OVERVIEW
========================================= */

function OverviewSection() {
  const [overview, setOverview] = useState<{
    text: string;
    formLink: string;
    formLabel: string;
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      const data = getOverview();
      setOverview(data);
    };

    refresh();

    return onOverviewChanged(refresh);
  }, []);

  if (!overview || !overview.text) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #dde3ea",
          borderRadius: 4,
          padding: 32,
          textAlign: "center",
          color: "#888",
          fontSize: 14,
        }}
      >
        No Overview content has been added yet.
        <br />
        Add it from the CMS (Impact Assessment
        → Overview) and it will appear here.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dde3ea",
        borderRadius: 4,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 10px",
          color: "#222",
        }}
      >
        Overview
      </h2>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#444",
          margin: "0 0 20px",
          whiteSpace: "pre-wrap",
        }}
      >
        {overview.text}
      </p>

      {overview.formLink && (
        <a
          href={overview.formLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "#003087",
            color: "#fff",
            borderRadius: 4,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {overview.formLabel || "Request Form"} ↗
        </a>
      )}
    </div>
  );
}