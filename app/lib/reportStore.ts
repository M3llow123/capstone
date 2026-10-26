// ── Shared client-side store (backed by Supabase) ──────────────────────
// Bridges the uploader (CMS edit pages) to the public report page.
// Content lives in Supabase; the browser talks to /api/content:
//   GET  = public, returns everything the report page shows
//   POST = needs the CMS login, saves one piece of content
//
// The functions keep the same shape as the old localStorage version
// (get* are synchronous, on*Changed fires when data changes), so the report
// page keeps working unchanged. get* return null until the first load
// finishes; a copy is kept in localStorage so repeat visits show instantly.
// The save* functions are now async: use `await` so errors can be caught.

import { logAudit } from "./auditStore";
import type { RainfallChartData } from "./rainfallChart";

export interface RegionReport {
  id: string;
  name: string;
  summary: string;
  images: string[];      // URLs of the uploaded climate maps (the first one is the report image)
  chart?: RainfallChartData | null; // daily rainfall data from the uploaded CSV (drives the interactive graph)
  month: string;          // e.g. "March 2026"
  updatedAt: string;      // ISO timestamp
}

export interface CategoryImageData {
  image: string;      // URL of the uploaded image
  updatedAt: string;  // ISO timestamp
}
export type CoverPageData = CategoryImageData;
export type AboutPageData = CategoryImageData;

export interface PrefaceBlock {
  id: string;
  type: "text" | "image";
  content: string; // plain text for "text" blocks, image URL (or data URL before saving) for "image" blocks
}
export interface PrefaceData {
  blocks: PrefaceBlock[];
  updatedAt: string; // ISO timestamp
}

export interface OverviewData {
  text: string;       // the Overview body text
  formLink: string;   // e.g. a Google Forms URL viewers can use to request something
  formLabel: string;  // button/link label, e.g. "Request Data"
  updatedAt: string;  // ISO timestamp
}

type ImageKey = "cover" | "about" | "corn" | "rice" | "rainfall" | "cyclone" | "drought";

interface Cache {
  images: Partial<Record<ImageKey, CategoryImageData>>;
  regions: Record<string, RegionReport>;
  preface: PrefaceData | null;
  overview: OverviewData | null;
}

// Same event names as before, so nothing else needs to change.
const EVENTS = {
  regions: "pagasa-reports-updated",
  preface: "pagasa-preface-updated",
  overview: "pagasa-overview-updated",
  image: {
    cover: "pagasa-cover-updated",
    about: "pagasa-about-updated",
    corn: "pagasa-corn-updated",
    rice: "pagasa-rice-updated",
    rainfall: "pagasa-rainfall-updated",
    cyclone: "pagasa-cyclone-updated",
    drought: "pagasa-drought-updated",
  } as Record<ImageKey, string>,
};

const MIRROR_KEY = "pagasa_content_cache";

let cache: Cache = { images: {}, regions: {}, preface: null, overview: null };
let loadState: "idle" | "loading" | "done" = "idle";
let focusHooked = false;

// ── Local copy (so the next visit shows content immediately) ───────────
function readMirror() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (raw) cache = { ...cache, ...JSON.parse(raw) };
  } catch {
    /* ignore a broken copy */
  }
}
function writeMirror() {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: not a problem */
  }
}
readMirror();

function emit(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}
function emitAll() {
  emit(EVENTS.regions);
  emit(EVENTS.preface);
  emit(EVENTS.overview);
  (Object.keys(EVENTS.image) as ImageKey[]).forEach((k) => emit(EVENTS.image[k]));
}

// ── Loading from the server ───────────────────────────────────────────
/** Reload everything from the database (only notifies listeners if something changed). */
export async function refreshContent(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/content", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const next: Cache = {
      images: data.images ?? {},
      regions: data.regions ?? {},
      preface: data.preface ?? null,
      overview: data.overview ?? null,
    };
    if (JSON.stringify(next) !== JSON.stringify(cache)) {
      cache = next;
      writeMirror();
      emitAll();
    }
  } catch (err) {
    console.error("Could not load report content:", err);
  } finally {
    loadState = "done";
  }
}

function ensureLoaded() {
  if (typeof window === "undefined" || loadState !== "idle") return;
  loadState = "loading";
  void refreshContent();
  if (!focusHooked) {
    focusHooked = true;
    // Pick up changes made on another device when the tab is used again.
    window.addEventListener("focus", () => {
      void refreshContent();
    });
  }
}

function subscribe(eventName: string, cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  ensureLoaded();
  window.addEventListener(eventName, cb);
  return () => window.removeEventListener(eventName, cb);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postContent(body: unknown): Promise<any> {
  const res = await fetch("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Save failed. Please try again.");
  return data;
}

// ── Regional reports ──────────────────────────────────────────────────
/** Save/update a region's uploaded report. Called from the uploader (edit) page. */
export async function saveRegionReport(report: Omit<RegionReport, "updatedAt">): Promise<{ chartSaved: boolean }> {
  if (typeof window === "undefined") return { chartSaved: true };
  const data = await postContent({ type: "region", ...report });
  const saved = data.region as RegionReport;
  // false when the server dropped the graph data (old API code or the `chart` column is missing)
  const chartSaved = !report.chart || !!saved.chart;
  // Keep the graph for this session even if the server did not echo it back.
  cache.regions[report.id] = { ...saved, chart: saved.chart ?? report.chart ?? null };
  writeMirror();
  emit(EVENTS.regions);
  void logAudit("UPDATE REGIONS IMPACT", report.name);
  return { chartSaved };
}

/** Delete a region's saved report (summary, graph data and images). */
export async function deleteRegionReport(id: string, name?: string): Promise<void> {
  if (typeof window === "undefined") return;
  await postContent({ type: "region_delete", id });
  delete cache.regions[id];
  writeMirror();
  emit(EVENTS.regions);
  void logAudit("DELETE REGIONS IMPACT", name);
}

/** Get a single region's report, if one has been uploaded. */
export function getRegionReport(id: string): RegionReport | null {
  ensureLoaded();
  return cache.regions[id] ?? null;
}

/** Get every uploaded region report, newest first. */
export function getAllRegionReports(): RegionReport[] {
  ensureLoaded();
  return Object.values(cache.regions).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Subscribe to changes. Returns an unsubscribe fn. */
export function onRegionReportsChanged(cb: () => void): () => void {
  return subscribe(EVENTS.regions, cb);
}

// ── Single-image stores (Corn, Rice, Rainfall, Cyclone, Drought, Cover, About) ──
function createImageStore(key: ImageKey, auditLabel: string) {
  const save = async (image: string): Promise<void> => {
    if (typeof window === "undefined") return;
    const data = await postContent({ type: "image", key, image });
    cache.images[key] = { image: data.image, updatedAt: data.updatedAt };
    writeMirror();
    emit(EVENTS.image[key]);
    void logAudit(`UPDATE ${auditLabel}`);
  };

  const get = (): CategoryImageData | null => {
    ensureLoaded();
    return cache.images[key] ?? null;
  };

  const onChange = (cb: () => void): (() => void) => subscribe(EVENTS.image[key], cb);

  return { save, get, onChange };
}

const cornStore = createImageStore("corn", "CORN CROP STAGE");
export const saveCornImage = cornStore.save;
export const getCornImage = cornStore.get;
export const onCornImageChanged = cornStore.onChange;

const riceStore = createImageStore("rice", "RICE CROP STAGE");
export const saveRiceImage = riceStore.save;
export const getRiceImage = riceStore.get;
export const onRiceImageChanged = riceStore.onChange;

const rainfallStore = createImageStore("rainfall", "MONTHLY RAINFALL");
export const saveRainfallImage = rainfallStore.save;
export const getRainfallImage = rainfallStore.get;
export const onRainfallImageChanged = rainfallStore.onChange;

const cycloneStore = createImageStore("cyclone", "TROPICAL CYCLONE");
export const saveCycloneImage = cycloneStore.save;
export const getCycloneImage = cycloneStore.get;
export const onCycloneImageChanged = cycloneStore.onChange;

const droughtStore = createImageStore("drought", "CROP CONDITION AND DROUGHT INDICATOR");
export const saveDroughtImage = droughtStore.save;
export const getDroughtImage = droughtStore.get;
export const onDroughtImageChanged = droughtStore.onChange;

const coverStore = createImageStore("cover", "COVER PAGE");
export const saveCoverImage = coverStore.save;
export const getCoverImage = (): CoverPageData | null => coverStore.get();
export const onCoverImageChanged = coverStore.onChange;

const aboutStore = createImageStore("about", "ABOUT THIS REPORT");
export const saveAboutImage = aboutStore.save;
export const getAboutImage = (): AboutPageData | null => aboutStore.get();
export const onAboutImageChanged = aboutStore.onChange;

// ── Preface (mixed text + image blocks) ───────────────────────────────
/** Save the Preface's ordered text/image blocks. Called from the Preface uploader. */
export async function savePreface(blocks: PrefaceBlock[]): Promise<void> {
  if (typeof window === "undefined") return;
  const data = await postContent({ type: "preface", blocks });
  cache.preface = data.preface ?? null;
  writeMirror();
  emit(EVENTS.preface);
  void logAudit("UPDATE PREFACE");
}

/** Get the current Preface content, if any has been saved. */
export function getPreface(): PrefaceData | null {
  ensureLoaded();
  return cache.preface;
}

/** Subscribe to Preface changes. Returns an unsubscribe fn. */
export function onPrefaceChanged(cb: () => void): () => void {
  return subscribe(EVENTS.preface, cb);
}

// ── Overview (text + a "request" form link) ───────────────────────────
/** Save the Overview text and request-form link. Called from the Overview uploader. */
export async function saveOverview(data: Omit<OverviewData, "updatedAt">): Promise<void> {
  if (typeof window === "undefined") return;
  const res = await postContent({ type: "overview", ...data });
  cache.overview = res.overview ?? null;
  writeMirror();
  emit(EVENTS.overview);
  void logAudit("UPDATE OVERVIEW");
}

/** Get the current Overview content, if any has been saved. */
export function getOverview(): OverviewData | null {
  ensureLoaded();
  return cache.overview;
}

/** Subscribe to Overview changes. Returns an unsubscribe fn. */
export function onOverviewChanged(cb: () => void): () => void {
  return subscribe(EVENTS.overview, cb);
}