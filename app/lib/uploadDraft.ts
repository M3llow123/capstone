import type { RainfallChartData } from "./rainfallChart";

// Holds the uploaded maps / CSV / summary between the Edit page and the Review page.
//
// Why this exists: the draft used to live ONLY in sessionStorage, which is capped at roughly 5 MB.
// Climate map images are bigger than that, so the write failed silently, the Review page then saved
// the report with NO image, and the report fell back to the old placeholder layout.
// The draft is now kept in memory (no size limit, survives the client-side page change) and
// sessionStorage is only a best-effort copy for page reloads.

export type UploadDraft = {
  images: { name: string; type: string; data: string }[];
  csvFiles: { name: string; text: string }[];
  summary: string;
  chart: RainfallChartData | null;
  month: string;
};

const memory = new Map<string, UploadDraft>();
const keyFor = (regionId: string) => `region-upload-draft:${regionId}`;

export function setUploadDraft(regionId: string, draft: UploadDraft): void {
  memory.set(regionId, draft);
  try {
    sessionStorage.setItem(keyFor(regionId), JSON.stringify(draft));
  } catch {
    // Too big for sessionStorage: fine, the in-memory copy above is what the Review page uses.
    try { sessionStorage.removeItem(keyFor(regionId)); } catch { /* ignore */ }
  }
}

export function getUploadDraft(regionId: string): UploadDraft | null {
  const inMemory = memory.get(regionId);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(keyFor(regionId));
    return raw ? (JSON.parse(raw) as UploadDraft) : null;
  } catch {
    return null;
  }
}

export function clearUploadDraft(regionId: string): void {
  memory.delete(regionId);
  try { sessionStorage.removeItem(keyFor(regionId)); } catch { /* ignore */ }
}