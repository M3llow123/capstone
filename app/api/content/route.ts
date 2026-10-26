import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUsername } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { validateChartPayload } from "../../lib/csvValidation";

export const dynamic = "force-dynamic";

const BUCKET = "report-images";
const IMAGE_KEYS = ["cover", "about", "corn", "rice", "rainfall", "cyclone", "drought"] as const;
type ImageKey = (typeof IMAGE_KEYS)[number];

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image

// ── Helpers ───────────────────────────────────────────────────────────
function isDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:");
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//.test(v);
}

/** Uploads a "data:image/...;base64,..." string to Storage and returns its public URL. */
async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  const marker = ";base64,";
  const cut = dataUrl.indexOf(marker);
  if (cut === -1) throw new Error("Invalid image.");

  const mime = dataUrl.slice(5, cut).toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw new Error("Only PNG, JPG, WEBP or GIF images are allowed.");

  const buffer = Buffer.from(dataUrl.slice(cut + marker.length), "base64");
  if (buffer.length === 0) throw new Error("The image is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 8 MB).");

  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Deletes files that are no longer used (best effort, never throws). */
/** Removes a region's saved report (summary, graph data and uploaded images). */
async function deleteRegion(id: unknown) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1 || n > 16) throw new Error("Unknown region.");

  const { data: existing } = await supabaseAdmin
    .from("region_reports")
    .select("images")
    .eq("region_id", n)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("region_reports").delete().eq("region_id", n);
  if (error) throw new Error(error.message);

  await removeByUrls(existing?.images ?? []);
  return { deleted: String(n) };
}

async function removeByUrls(urls: string[]) {
  const paths = urls.map(pathFromPublicUrl).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabaseAdmin.storage.from(BUCKET).remove(paths);
  } catch {
    /* leftover files are harmless */
  }
}

// ── GET: everything the public report shows (no login needed) ─────────
export async function GET() {
  const [images, preface, overview, regions] = await Promise.all([
    supabaseAdmin.from("report_images").select("key,image_url,updated_at"),
    supabaseAdmin.from("preface_blocks").select("id,type,content,updated_at").order("position"),
    supabaseAdmin
      .from("overview")
      .select("text,form_link,form_label,updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabaseAdmin.from("region_reports").select("region_id,name,summary,month,images,chart,updated_at"),
  ]);

  const failed = images.error ?? preface.error ?? overview.error ?? regions.error;
  if (failed) return NextResponse.json({ error: failed.message }, { status: 500 });

  const imageMap: Record<string, { image: string; updatedAt: string }> = {};
  for (const row of images.data ?? []) {
    imageMap[row.key] = { image: row.image_url, updatedAt: row.updated_at };
  }

  const blocks = (preface.data ?? []).map((r) => ({ id: r.id, type: r.type, content: r.content }));
  const prefaceOut = blocks.length
    ? {
        blocks,
        updatedAt: (preface.data ?? []).reduce(
          (latest, r) => (r.updated_at > latest ? r.updated_at : latest),
          ""
        ),
      }
    : null;

  const o = overview.data;
  const overviewOut =
    o && (o.text || o.form_link || o.form_label)
      ? { text: o.text, formLink: o.form_link, formLabel: o.form_label, updatedAt: o.updated_at }
      : null;

  const regionMap: Record<string, unknown> = {};
  for (const r of regions.data ?? []) {
    regionMap[String(r.region_id)] = {
      id: String(r.region_id),
      name: r.name,
      summary: r.summary,
      month: r.month,
      images: r.images ?? [],
      chart: r.chart ?? null,
      updatedAt: r.updated_at,
    };
  }

  return NextResponse.json({
    images: imageMap,
    preface: prefaceOut,
    overview: overviewOut,
    regions: regionMap,
  });
}

// ── POST: save content (CMS login required) ───────────────────────────
async function saveImage(key: unknown, image: unknown) {
  if (typeof key !== "string" || !IMAGE_KEYS.includes(key as ImageKey)) {
    throw new Error("Unknown image.");
  }

  const { data: existing } = await supabaseAdmin
    .from("report_images")
    .select("image_path,image_url")
    .eq("key", key)
    .maybeSingle();

  // Re-saving the image that is already there: nothing to upload.
  if (isHttpUrl(image) && existing?.image_url === image) {
    return { image: existing.image_url, updatedAt: new Date().toISOString() };
  }
  if (!isDataUrl(image)) throw new Error("Please choose an image file.");

  const url = await uploadDataUrl(image, key);
  const path = pathFromPublicUrl(url);
  const updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("report_images")
    .upsert({ key, image_path: path ?? "", image_url: url, updated_at: updatedAt }, { onConflict: "key" });
  if (error) throw new Error(error.message);

  if (existing?.image_url) await removeByUrls([existing.image_url]);
  return { image: url, updatedAt };
}

type BlockIn = { type?: unknown; content?: unknown };

async function savePreface(blocks: unknown) {
  if (!Array.isArray(blocks)) throw new Error("Invalid preface.");

  const { data: old } = await supabaseAdmin.from("preface_blocks").select("id,type,content");

  const rows: { position: number; type: "text" | "image"; content: string }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] as BlockIn;
    const content = String(b?.content ?? "");
    if (b?.type === "text") {
      rows.push({ position: i, type: "text", content });
    } else if (b?.type === "image") {
      if (isDataUrl(content)) {
        rows.push({ position: i, type: "image", content: await uploadDataUrl(content, "preface") });
      } else if (isHttpUrl(content)) {
        rows.push({ position: i, type: "image", content });
      }
    }
  }

  let saved: { id: string; type: "text" | "image"; content: string; updated_at: string }[] = [];
  if (rows.length) {
    const { data, error } = await supabaseAdmin
      .from("preface_blocks")
      .insert(rows)
      .select("id,type,content,updated_at")
      .order("position");
    if (error) throw new Error(error.message);
    saved = data ?? [];
  }

  const oldIds = (old ?? []).map((r) => r.id);
  if (oldIds.length) {
    const { error } = await supabaseAdmin.from("preface_blocks").delete().in("id", oldIds);
    if (error) throw new Error(error.message);
  }

  const keptUrls = new Set(saved.filter((r) => r.type === "image").map((r) => r.content));
  await removeByUrls(
    (old ?? []).filter((r) => r.type === "image" && !keptUrls.has(r.content)).map((r) => r.content)
  );

  return {
    preface: saved.length
      ? {
          blocks: saved.map((r) => ({ id: r.id, type: r.type, content: r.content })),
          updatedAt: new Date().toISOString(),
        }
      : null,
  };
}

async function saveOverview(b: { text?: unknown; formLink?: unknown; formLabel?: unknown }) {
  const text = String(b.text ?? "");
  const formLink = String(b.formLink ?? "");
  const formLabel = String(b.formLabel ?? "");
  const updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("overview")
    .upsert(
      { id: 1, text, form_link: formLink, form_label: formLabel, updated_at: updatedAt },
      { onConflict: "id" }
    );
  if (error) throw new Error(error.message);

  return { overview: { text, formLink, formLabel, updatedAt } };
}

/** Keeps only well-formed chart data (days + series of numbers); anything else becomes null. */
function cleanChart(v: unknown) {
  if (!v || typeof v !== "object") return null;
  const c = v as { days?: unknown; series?: unknown };
  if (!Array.isArray(c.days) || !Array.isArray(c.series)) return null;
  if (c.days.length < 2 || c.days.length > 366 || c.series.length < 1 || c.series.length > 30) return null;
  const days = c.days.map((d) => String(d).slice(0, 12));
  const series = [];
  for (const s of c.series as Record<string, unknown>[]) {
    const pct = Array.isArray(s?.pct) ? s.pct.map((x) => Number(x) || 0) : null;
    if (!pct || pct.length !== days.length) return null;
    const mm = Array.isArray(s.mm) && s.mm.length === days.length ? s.mm.map((x) => Number(x) || 0) : null;
    series.push({
      name: String(s.name ?? "").slice(0, 60),
      color: /^#[0-9a-fA-F]{6}$/.test(String(s.color)) ? String(s.color) : "#888888",
      pct,
      mm,
    });
  }
  // Disclosure that some values are system-generated zeros (kept so the public report can show it).
  const sub = (c as { substituted?: unknown }).substituted as
    | { count?: unknown; sourceFile?: unknown; cells?: unknown; note?: unknown }
    | undefined;
  if (sub && typeof sub === "object" && Number(sub.count) > 0 && Array.isArray(sub.cells)) {
    const cells = (sub.cells as Record<string, unknown>[]).slice(0, 500).map((x) => ({
      province: String(x?.province ?? "").slice(0, 60),
      date: String(x?.date ?? "").slice(0, 20),
      row: Number(x?.row) || 0,
    }));
    return {
      days,
      series,
      substituted: {
        count: Math.min(Number(sub.count) || 0, 100000),
        sourceFile: String(sub.sourceFile ?? "").slice(0, 200),
        cells,
        note: String(sub.note ?? "").slice(0, 600),
      },
    };
  }
  return { days, series };
}

async function saveRegion(b: {
  id?: unknown;
  name?: unknown;
  summary?: unknown;
  month?: unknown;
  images?: unknown;
  chart?: unknown;
}) {
  const n = Number(b.id);
  if (!Number.isInteger(n) || n < 1 || n > 16) throw new Error("Unknown region.");

  const { data: existing } = await supabaseAdmin
    .from("region_reports")
    .select("images,chart")
    .eq("region_id", n)
    .maybeSingle();
  const oldImages: string[] = existing?.images ?? [];

  const images: string[] = [];
  for (const img of Array.isArray(b.images) ? b.images : []) {
    if (isDataUrl(img)) images.push(await uploadDataUrl(img, `regions/${n}`));
    else if (isHttpUrl(img)) images.push(img);
  }

  const name = String(b.name ?? "");
  const summary = String(b.summary ?? "");
  const month = String(b.month ?? "");
  // Double check on the server: never store graph data that is out of range / not numeric,
  // even if the browser-side CSV validation was skipped or tampered with.
  const chartProblem = b.chart === undefined ? null : validateChartPayload(b.chart);
  if (chartProblem) throw new Error(`The rainfall data was not saved: ${chartProblem}`);
  // A save that does not mention the chart (older client, summary-only edit) keeps the stored one.
  const chart = b.chart === undefined ? (existing?.chart ?? null) : cleanChart(b.chart);
  const updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("region_reports")
    .upsert(
      { region_id: n, name, summary, month, images, chart, updated_at: updatedAt },
      { onConflict: "region_id" }
    );
  if (error) throw new Error(error.message);

  await removeByUrls(oldImages.filter((u) => !images.includes(u)));

  return { region: { id: String(n), name, summary, month, images, chart, updatedAt } };
}

export async function POST(req: NextRequest) {
  const username = await getSessionUsername(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );
  if (!username) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    switch (body.type) {
      case "image":
        return NextResponse.json(await saveImage(body.key, body.image));
      case "preface":
        return NextResponse.json(await savePreface(body.blocks));
      case "overview":
        return NextResponse.json(await saveOverview(body));
      case "region":
        return NextResponse.json(await saveRegion(body));
      case "region_delete":
        return NextResponse.json(await deleteRegion(body.id));
      default:
        return NextResponse.json({ error: "Unknown request." }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
