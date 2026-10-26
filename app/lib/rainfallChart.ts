// ── Daily-rainfall chart data (built from the uploaded CSV) ─────────────
// The bottom graph of the regional report ("% of monthly rainfall total",
// one line per province) is drawn from this, so it can be hovered / filtered
// instead of being a flat picture.
//
// Accepted CSV layouts (header row required, delimiter , ; or tab):
//   WIDE  date,Aurora,Bataan,Bulacan,...        one row per day
//   LONG  date,province,value                   one row per day per province
// "date" can be 2026-08-01, 01/08/2026 (day/month/year), 01-Aug, or just the day number (1..31).
// Values are treated as mm of rainfall and converted to "% of monthly total",
// unless every province already adds up to ~100 (then they are used as-is).

export interface RainfallSeries {
  name: string;
  color: string;
  pct: number[]; // % of the month's total, one value per day
  mm: number[] | null; // original mm values when the CSV had mm
}

export interface RainfallChartData {
  days: string[]; // axis labels, e.g. "01-Aug"
  series: RainfallSeries[];
  /** Present only when missing CSV values were replaced with 0 (with the user's consent). Shown under the graph. */
  substituted?: {
    count: number;
    sourceFile: string;
    cells: { province: string; date: string; row: number }[]; // exactly which values are system-generated
    note: string;
  };
}

// Same colours as the R-generated graph in the report image.
const KNOWN_COLORS: Record<string, string> = {
  aurora: "#b2df8a",
  bataan: "#33a02c",
  bulacan: "#fb9a99",
  "nueva ecija": "#e31a1c",
  pampanga: "#ff7f00",
  tarlac: "#fdbf6f",
  zambales: "#1f78b4",
};
const FALLBACK = [
  "#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c",
  "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#b15928", "#999999",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === delim && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNum(s: string | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(s.replace(/[%,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Turns a date cell into { sortKey, label }. Returns null if it isn't a date/day. */
function parseDay(raw: string, monthHint: number | null, dayFirst = true): { key: number; label: string } | null {
  const s = raw.trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  let month: number | null = null;
  let day: number | null = null;
  let year = 0;

  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { year = +m[1]; month = +m[2] - 1; day = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/))) {
    // 01/04/2026 is 1 April (day first) unless the file proves otherwise
    const a = +m[1], b = +m[2];
    day = dayFirst ? a : b; month = (dayFirst ? b : a) - 1; year = +m[3];
    if (year < 100) year += 2000;
  }
  else if ((m = s.match(/^(\d{1,2})[-\s/]?([A-Za-z]{3})[a-z]*/))) { day = +m[1]; month = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase()); }
  else if ((m = s.match(/^([A-Za-z]{3})[a-z]*[-\s/]?(\d{1,2})$/))) { month = MONTHS.findIndex((x) => x.toLowerCase() === m![1].toLowerCase()); day = +m[2]; }
  else if (/^\d{1,2}$/.test(s)) { day = +s; month = monthHint; }

  if (day == null || day < 1 || day > 31) return null;
  if (month == null || month < 0 || month > 11) return null;
  return { key: year * 10000 + month * 100 + day, label: `${String(day).padStart(2, "0")}-${MONTHS[month]}` };
}

export function parseRainfallCsv(text: string, monthHint: number | null = null): RainfallChartData | null {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return null;
  const delim = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const rows = lines.map((l) => splitLine(l, delim));
  const header = rows[0];
  const body = rows.slice(1);
  if (header.length < 2) return null;

  const dayCol = 0;
  // day/month vs month/day: day-first (Philippine format) unless a value like 08/31/2026 shows otherwise
  let dayFirst = true;
  for (const r of body) {
    const m = (r[dayCol] ?? "").match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}$/);
    if (m && +m[1] <= 12 && +m[2] > 12) { dayFirst = false; break; }
    if (m && +m[1] > 12) { dayFirst = true; break; }
  }
  const days = new Map<number, string>(); // key -> label
  const byProv = new Map<string, Map<number, number>>(); // province -> key -> mm

  const lower = header.map((h) => h.toLowerCase());
  const provCol = lower.findIndex((h) => /province|prov|name|area/.test(h));
  const valCol = lower.findIndex((h, i) => i !== provCol && /rain|value|mm|precip|pcp|pct|percent/.test(h));

  if (header.length >= 3 && provCol !== -1 && valCol !== -1) {
    // LONG layout
    for (const r of body) {
      const d = parseDay(r[dayCol], monthHint, dayFirst);
      const p = r[provCol];
      if (!d || !p) continue;
      days.set(d.key, d.label);
      if (!byProv.has(p)) byProv.set(p, new Map());
      byProv.get(p)!.set(d.key, toNum(r[valCol]));
    }
  } else {
    // WIDE layout
    for (const r of body) {
      const d = parseDay(r[dayCol], monthHint, dayFirst);
      if (!d) continue;
      days.set(d.key, d.label);
      for (let c = 1; c < header.length; c++) {
        const p = header[c];
        if (!p) continue;
        if (!byProv.has(p)) byProv.set(p, new Map());
        byProv.get(p)!.set(d.key, toNum(r[c]));
      }
    }
  }

  const keys = [...days.keys()].sort((a, b) => a - b);
  if (keys.length < 2 || byProv.size === 0) return null;

  const raw = [...byProv.entries()].map(([name, m]) => ({ name, vals: keys.map((k) => m.get(k) ?? 0) }));
  const sums = raw.map((s) => s.vals.reduce((a, b) => a + b, 0));
  const alreadyPct = sums.every((t) => t === 0 || Math.abs(t - 100) < 2);

  let fb = 0;
  const series: RainfallSeries[] = raw.map((s, i) => {
    const total = sums[i];
    return {
      name: s.name,
      color: KNOWN_COLORS[s.name.toLowerCase()] ?? FALLBACK[fb++ % FALLBACK.length],
      pct: alreadyPct ? s.vals : s.vals.map((v) => (total > 0 ? (v / total) * 100 : 0)),
      mm: alreadyPct ? null : s.vals,
    };
  });

  return { days: keys.map((k) => days.get(k)!), series };
}

/**
 * Builds the graph data from a CSV that already passed validation (see csvValidation.ts).
 * Values are used exactly as uploaded: they are already "% of monthly total", so
 * nothing is rescaled or "fixed" — what the admin confirmed is what gets drawn.
 */
export function chartFromValidatedTable(t: { dates: string[]; provinces: string[]; values: number[][] }): RainfallChartData {
  let fb = 0;
  return {
    days: t.dates.map((iso) => {
      const [, m, d] = iso.split("-").map(Number);
      return `${String(d).padStart(2, "0")}-${MONTHS[m - 1]}`;
    }),
    series: t.provinces.map((name, i) => ({
      name,
      color: KNOWN_COLORS[name.toLowerCase()] ?? FALLBACK[fb++ % FALLBACK.length],
      pct: t.values[i],
      mm: null,
    })),
  };
}

// ════════════════════════════════════════════════════════════════════════
// Reading the graph straight from the report image
// ════════════════════════════════════════════════════════════════════════
// When no usable CSV was uploaded, the report still shows the graph that is
// printed in the image. To make that graph hoverable, we "digitize" it: for
// every day we look up where each province's coloured line sits and convert
// the height into "% of monthly rainfall total".
//
// The numbers are ESTIMATES (typically within ~1 percentage point) because
//  - the y-axis labels are only pixels, so the scale is derived from the rule
//    that each province's daily values add up to 100 %, and
//  - where lines overlap exactly, the hidden one is rebuilt from its neighbours
//    or left empty.
// A CSV gives exact values and always takes priority over this.
//
// Positions below are pixel coordinates in the standard 1448 x 2048 report image.

const BASE_W = 1448;
const BASE_H = 2048;
const G = {
  legendTop: 1724, legendBot: 1754, // band that holds the province legend
  plotTop: 1766, plotBot: 2003,     // inside of the plot box
  y0: 1996,                          // y of 0 %
  yTop: 1774.5,                      // y of the top tick (= highest value on the graph)
  gridTop: 1790, gridBot: 1990,      // rows used to find the vertical day gridlines
};

export interface EstimatedSeries {
  name: string;
  color: string;
  pct: (number | null)[]; // estimated % of monthly total, null = hidden behind another line
  y: (number | null)[];   // line height in report-image pixels (for drawing hover dots)
}
export interface EstimatedChart {
  xs: number[]; // x of each day as a fraction (0..1) of the image width
  series: EstimatedSeries[];
  top: number;  // estimated value at the top of the graph (%)
}

const PROVINCES: [RegExp, string[]][] = [
  [/Ilocos/i, ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"]],
  [/Cagayan Valley/i, ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"]],
  [/Central Luzon/i, ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"]],
  [/Cordillera|\bCAR\b/i, ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"]],
  [/CALABARZON/i, ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"]],
  [/MIMAROPA/i, ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"]],
  [/Bicol/i, ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"]],
  [/Western Visayas/i, ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"]],
  [/Central Visayas/i, ["Bohol", "Cebu", "Negros Oriental", "Siquijor"]],
  [/Eastern Visayas/i, ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"]],
  [/Zamboanga/i, ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"]],
  [/Northern Mindanao/i, ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"]],
  [/Davao/i, ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"]],
  [/SOCCSKSARGEN/i, ["Cotabato", "Sarangani", "South Cotabato", "Sultan Kudarat"]],
  [/CARAGA/i, ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"]],
  [/BARMM|Bangsamoro/i, ["Basilan", "Lanao del Sur", "Maguindanao del Norte", "Maguindanao del Sur", "Sulu", "Tawi-Tawi"]],
];

/** The legend is alphabetical, so provinces are matched to swatches in order (only if the counts agree). */
function provinceNames(regionName: string, n: number): string[] {
  for (const [re, list] of PROVINCES) if (re.test(regionName) && list.length === n) return list;
  return Array.from({ length: n }, (_, i) => `Province ${i + 1}`);
}

const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Pure pixel logic (RGBA bytes in, estimate out) so it can be tested without a browser. */
export function estimateChartFromPixels(
  data: ArrayLike<number>,
  w: number,
  h: number,
  regionName: string
): EstimatedChart | null {
  if (!w || !h || Math.abs(h / w - BASE_H / BASE_W) > 0.03) return null; // not the standard report image
  const s = w / BASE_W;
  const at = (x: number, y: number): [number, number, number] => {
    const xi = Math.min(w - 1, Math.max(0, Math.round(x)));
    const yi = Math.min(h - 1, Math.max(0, Math.round(y)));
    const i = (yi * w + xi) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // 1) vertical day gridlines (light grey) -> x of every day
  const rows: number[] = [];
  for (let y = G.gridTop; y <= G.gridBot; y += 2) rows.push(y * s);
  const gridCols: number[] = [];
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (const y of rows) {
      const [r, g, b] = at(x, y);
      if (r > 170 && r < 215 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8) c++;
    }
    if (c / rows.length > 0.4) gridCols.push(x);
  }
  const days: number[] = [];
  let run: number[] = [];
  for (const x of gridCols) {
    if (run.length && x - run[run.length - 1] > 2) { days.push(run.reduce((a, b) => a + b, 0) / run.length); run = []; }
    run.push(x);
  }
  if (run.length) days.push(run.reduce((a, b) => a + b, 0) / run.length);
  if (days.length < 28 || days.length > 31) return null;

  // 2) legend swatches -> one colour per province (left to right)
  type Sw = { x0: number; y: number; cols: number[][] };
  const sw: Sw[] = [];
  for (let y = G.legendTop * s; y <= G.legendBot * s; y++) {
    let x = 0;
    while (x < w) {
      const [r, g, b] = at(x, y);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 45 && Math.max(r, g, b) > 110) {
        const start = x;
        while (x < w) {
          const [r2, g2, b2] = at(x, y);
          if (!(Math.max(r2, g2, b2) - Math.min(r2, g2, b2) > 45 && Math.max(r2, g2, b2) > 110)) break;
          x++;
        }
        if (x - start >= 10 * s) {
          const col = at((start + x) / 2, y);
          const hit = sw.find((q) => Math.abs(q.x0 - start) < 6 * s && Math.abs(q.y - y) <= 6 * s);
          if (hit) { hit.cols.push(col); hit.y = y; } else sw.push({ x0: start, y, cols: [col] });
        }
      } else x++;
    }
  }
  sw.sort((a, b) => Math.round(a.y / (12 * s)) - Math.round(b.y / (12 * s)) || a.x0 - b.x0);
  if (sw.length < 2 || sw.length > 12) return null;
  const colors = sw.map((q) => [0, 1, 2].map((k) => median(q.cols.map((c) => c[k]))));

  // 3) follow each coloured line
  const pTop = G.plotTop * s, pBot = G.plotBot * s;
  const cluster = (x: number, c: number[]): [number, number] | null => {
    let first = -1, last = -1, bestLen = 0, bestA = -1, bestB = -1;
    for (let y = Math.round(pTop); y <= Math.round(pBot); y++) {
      const [r, g, b] = at(x, y);
      const hit = Math.hypot(r - c[0], g - c[1], b - c[2]) < 50;
      if (hit) {
        if (first === -1 || y - last > 3 * s) { first = y; }
        last = y;
        if (last - first + 1 > bestLen) { bestLen = last - first + 1; bestA = first; bestB = last; }
      }
    }
    return bestLen ? [bestA, bestB] : null;
  };
  const sideMid = (x: number, c: number[], dir: number): number | null => {
    for (const k of [7, 10]) {
      const r = cluster(x + dir * k * s, c);
      if (r) return (r[0] + r[1]) / 2;
    }
    return null;
  };
  const yAt = (x: number, c: number[]): number | null => {
    let r: [number, number] | null = null;
    for (const k of [0, 1, -1, 2, -2, 3, -3]) { r = cluster(x + k * s, c); if (r) break; }
    const L = sideMid(x, c, -1), R = sideMid(x, c, 1);
    if (r) {
      const [t, b] = r, mid = (t + b) / 2;
      if (b - t >= 5 * s && L !== null && R !== null) {
        if (L > mid + 2 * s && R > mid + 2 * s) return t + 1.5 * s;   // peak: take the tip
        if (L < mid - 2 * s && R < mid - 2 * s) return b - 1.5 * s;   // valley
      }
      return mid;
    }
    // hidden under another line: rebuild from both sides
    const pts: number[] = [];
    for (const dir of [-1, 1]) {
      const p: [number, number][] = [];
      for (const k of [7, 14]) {
        const rr = cluster(x + dir * k * s, c);
        if (rr) p.push([dir * k * s, (rr[0] + rr[1]) / 2]);
      }
      if (p.length === 2) pts.push(p[0][1] + ((p[1][1] - p[0][1]) * (0 - p[0][0])) / (p[1][0] - p[0][0]));
      else if (p.length === 1) pts.push(p[0][1]);
    }
    return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
  };

  const y0 = G.y0 * s, yTop = G.yTop * s;
  const ysAll = colors.map((c) => days.map((x) => yAt(x, c)));
  const frac = (y: number) => Math.max(0, (y0 - y) / (y0 - yTop)); // 0 = baseline, 1 = top tick

  // 4) scale: every province's daily values add up to 100 % -> top = median(100 / sum of fractions)
  const tops = ysAll
    .map((ys) => ys.reduce((a: number, y) => a + (y === null ? 0 : frac(y)), 0))
    .filter((t) => t > 0.2)
    .map((t) => 100 / t);
  if (!tops.length) return null;
  const top = median(tops);

  const names = provinceNames(regionName, colors.length);
  return {
    xs: days.map((x) => x / w),
    top,
    series: colors.map((c, i) => ({
      name: names[i],
      color: hex(c),
      pct: ysAll[i].map((y) => (y === null ? null : frac(y) * top)),
      y: ysAll[i].map((y) => (y === null ? null : y / s)),
    })),
  };
}

/** Browser wrapper: loads the image, reads its pixels and estimates the graph. Returns null if anything fails (e.g. image host blocks pixel access). */
export async function estimateChartFromImage(url: string, regionName: string): Promise<EstimatedChart | null> {
  if (typeof window === "undefined") return null;
  try {
    // A separate request in CORS mode; the query string keeps it from reusing the plain <img> cache entry.
    const src = url.startsWith("data:") ? url : url + (url.includes("?") ? "&" : "?") + "cors=1";
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => res(el);
      el.onerror = () => rej(new Error("image load failed"));
      el.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return estimateChartFromPixels(px.data, canvas.width, canvas.height, regionName);
  } catch {
    return null;
  }
}
   