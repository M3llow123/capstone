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
import UserMenu from "@/app/components/UserMenu";

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

  const [now, setNow] = useState<Date | null>(null);

  /* =========================================
     SELECTED REGION REPORT
  ========================================= */

  useEffect(() => {
    if (!selectedRegionId) {
      setSelectedRegionReport(null);
      return;
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
      setSelectedCategoryImage(null);
      return;
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
      style={{
        height: "100vh",
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

        .region-item {
          background: #c3c8da;
          color: #1c2b3a;
        }

        .region-item:hover {
          background: #1c2b3a;
          color: #ffffff;
        }
      `}</style>

      {/* =====================================
          GOVPH TOP BAR
      ====================================== */}

      <div
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

        <span
          style={{
            fontWeight: 700,
            letterSpacing: ".02em",
          }}
        >
          GOVPH
        </span>

        <span
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
      </div>

      {/* =====================================
          PAGASA HEADER
      ====================================== */}

      <div
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
          width={56}
          height={56}
          style={{ display: "block", flexShrink: 0 }}
        />

        <div>
          <div
            style={{
              fontSize: 11,
              color: "#555",
            }}
          >
            Department of Science and Technology
          </div>

          <div
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
      </div>

      {/* =====================================
          BODY
      ====================================== */}

      <div
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

                    setSelectedRegionId(null);
                    setRegionsPanelOpen(false);
                    setRegionsListOpen(false);
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

              setRegionsListOpen(false);
              setSelectedCategory(null);
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

        {/* ===================================
            MAIN CONTENT (only this scrolls)
        ==================================== */}

        <div
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
                  }}
                >
                  <button
                    onClick={() => {
                      setRegionsPanelOpen(true);
                      setRegionsListOpen(true);
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
                    <ChevronDown size={14} style={{ flexShrink: 0 }} />
                  </button>

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

function CoverPage({
  now,
}: {
  now: Date | null;
}) {
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

  const monthYear = now
    ? `${now
        .toLocaleString("default", {
          month: "long",
        })
        .toUpperCase()} ${now.getFullYear()}`
    : "MARCH 2026";

  /* =======================================
     UPLOADED COVER IMAGE
  ======================================== */

  if (coverImage) {
    return (
      <div
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
     DEFAULT COVER PAGE
  ======================================== */

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 760,
        background:
          "linear-gradient(135deg, #a9c9a5 0%, #d9d3a1 55%, #a9c9a5 100%)",
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
        minHeight: 620,
      }}
    >
      {/* Header strip */}

      <div
        style={{
          padding: "22px 28px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background:
              "conic-gradient(#0072bc 0 25%, #fcd116 25% 50%, #ce1126 50% 75%, #0072bc 75% 100%)",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: "#5b3a1a",
            lineHeight: 1.3,
            letterSpacing: ".01em",
          }}
        >
          DEPARTMENT OF SCIENCE AND TECHNOLOGY -
          <br />
          PHILIPPINE ATMOSPHERICAL,
          GEOPHYSICAL, AND
          <br />
          ASTRONOMICAL SERVICES ADMINISTRATION
        </div>
      </div>

      {/* Title + graphic */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 40px 30px",
          gap: 24,
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#2b6b2f",
              lineHeight: 1.05,
              fontFamily:
                "Impact, 'Arial Black', sans-serif",
            }}
          >
            CLIMATE IMPACT
            <br />
            ASSESSMENT
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#2b6b2f",
              borderTop:
                "3px solid #c0522f",
              display: "inline-block",
              paddingTop: 6,
              marginTop: 6,
            }}
          >
            FOR PHILIPPINE AGRICULTURE
          </div>

          <div
            style={{
              marginTop: 26,
              display: "inline-block",
              background: "#e79a2e",
              color: "#fff",
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {monthYear}
            <br />
            NUMBER 03 | VOLUME 42
          </div>
        </div>

        {/* Circular illustration */}

        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "linear-gradient(180deg, #bfe3f0 0%, #bfe3f0 55%, #c9dc8f 55%, #8fae5a 100%)",
            border:
              "6px solid #e79a2e",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: "50%",
              transform:
                "translateX(-50%)",
              fontSize: 64,
            }}
          >
            🌾🌽
          </div>
        </div>
      </div>

      {/* Dotted footer */}

      <div
        style={{
          height: 130,
          background:
            "linear-gradient(120deg, #a9c9a5 0%, #dccf9c 50%, #a9c9a5 100%)",
          backgroundImage:
            "radial-gradient(circle, rgba(139,111,58,.45) 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        }}
      />
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