"use client";

/**
 * Public-report viewer for one regional report.
 *
 *  - <RegionReportPanel>   what the "Regions" panel shows: a small toolbar
 *                          (Listen + Translate + Download PDF) above the
 *                          shrunken A4 preview. Clicking the preview opens the
 *                          lightbox.
 *  - The lightbox shows the full-size document with the same toolbar pinned
 *    to the top.
 *
 * Listen    reads the Regional Summary aloud in a news-reporter style with the
 *           browser's built-in text-to-speech (window.speechSynthesis).
 *           No API key or server.
 * Translate sends the summary to /api/translate (server-side, key stays
 *           private), shows the Tagalog version in the document, and caches it
 *           in localStorage. Listen and Download PDF then use the Tagalog text.
 * Download  opens the browser's print dialog with ONLY the A4 document in it;
 *           choose "Save as PDF" as the destination to get the file.
 */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import RegionReportDocument, { getSummaryText } from "./RegionReportDocument";
import { ZoomableBlock } from "./ZoomableImage";
import type { RainfallChartData } from "../lib/rainfallChart";

type Lang = "en" | "tl";

/* =========================================
   TRANSLATION (English <-> Tagalog)
========================================= */

type Translation = {
  lang: Lang;
  /** the summary to display / read / print in the current language */
  displaySummary: string;
  translating: boolean;
  error: string | null;
  toggle: () => void;
};

function useTagalogTranslation(
  regionName: string,
  month: string,
  summary: string
): Translation {
  const [lang, setLang] = useState<Lang>("en");
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow response landing after the region has changed.
  const requestId = useRef(0);

  // A different region / month / summary is shown: back to English.
  useEffect(() => {
    requestId.current++;
    setLang("en");
    setTranslated(null);
    setTranslating(false);
    setError(null);
  }, [regionName, month, summary]);

  async function toggle() {
    if (lang === "tl") {
      setLang("en");
      return;
    }

    const cacheKey = `summary-tl:${regionName}:${month}:${summary.length}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setTranslated(cached);
        setLang("tl");
        setError(null);
        return;
      }
    } catch {
      /* storage unavailable: just translate */
    }

    const id = ++requestId.current;
    setTranslating(true);
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation failed.");
      if (id !== requestId.current) return; // region changed meanwhile

      try {
        localStorage.setItem(cacheKey, data.text);
      } catch {
        /* ignore */
      }
      setTranslated(data.text);
      setLang("tl");
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Translation failed.");
    } finally {
      if (id === requestId.current) setTranslating(false);
    }
  }

  return {
    lang,
    displaySummary: lang === "tl" && translated ? translated : summary,
    translating,
    error,
    toggle,
  };
}

/* =========================================
   TEXT-TO-SPEECH HELPERS
========================================= */

// Bumped every time speech starts or stops. A running chain of sentences
// compares its own token to this one and quietly stops if they differ.
let speechToken = 0;

// Turns the summary into a broadcast-style script.
function toSpeakable(regionName: string, summary: string, lang: Lang): string {
  const base = getSummaryText(summary);

  if (lang === "tl") {
    const text = base
      .replace(/(\d+(?:\.\d+)?)\s?mm\b/gi, "$1 milimetro")
      .replace(/(\d+(?:\.\d+)?)\s?km\/h\b/gi, "$1 kilometro bawat oras")
      .replace(/(\d+(?:\.\d+)?)\s?°\s?C\b/g, "$1 digri Celsius")
      .replace(/(\d+(?:\.\d+)?)\s?%/g, "$1 porsyento")
      .replace(/[*_#`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return `Narito ang pinakahuling ulat para sa ${regionName}. ${text} Iyan ang pagtataya para sa ${regionName}.`;
  }

  const text = base
    .replace(/(\d+(?:\.\d+)?)\s?mm\b/gi, "$1 millimeters")
    .replace(/(\d+(?:\.\d+)?)\s?km\/h\b/gi, "$1 kilometers per hour")
    .replace(/(\d+(?:\.\d+)?)\s?°\s?C\b/g, "$1 degrees Celsius")
    .replace(/(\d+(?:\.\d+)?)\s?%/g, "$1 percent")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return `Here's the latest for ${regionName}. ${text} That's the regional outlook for ${regionName}.`;
}

// Chrome cuts off long utterances after ~15 seconds, so read it sentence by sentence.
function toChunks(text: string, max = 180): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length <= max) {
      out.push(sentence);
      continue;
    }
    let cur = "";
    for (const part of sentence.split(/(?<=[,;:])\s+/)) {
      if (cur && (cur + " " + part).length > max) {
        out.push(cur);
        cur = part;
      } else {
        cur = cur ? `${cur} ${part}` : part;
      }
    }
    if (cur) out.push(cur);
  }
  return out.filter((c) => c.trim());
}

// Ranks voices so natural / neural ones win over robotic defaults.
function scoreVoice(v: SpeechSynthesisVoice, lang: Lang): number {
  const name = v.name.toLowerCase();
  const vl = v.lang.toLowerCase().replace("_", "-");
  let s = 0;

  if (lang === "tl") {
    if (vl === "fil-ph") s += 30;
    else if (vl.startsWith("fil") || vl.startsWith("tl")) s += 20;
    else return -1; // not Filipino / Tagalog
  } else {
    if (v.lang === "en-PH") s += 30;
    else if (v.lang === "en-US") s += 20;
    else if (vl.startsWith("en")) s += 10;
    else return -1; // not English
  }

  if (name.includes("natural") || name.includes("online")) s += 50; // Edge neural voices
  if (name.includes("premium") || name.includes("enhanced")) s += 40; // Apple
  if (name.includes("google")) s += 25;
  if (/(aria|jenny|guy|rosa|james|ava|samantha|daniel)/.test(name)) s += 10;
  if (name.includes("espeak") || name.includes("compact")) s -= 50; // robotic

  return s;
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis
    .getVoices()
    .map((v) => ({ v, s: scoreVoice(v, lang) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.v;
}

/* ---- Emotion: the browser voice can't "act", but rate, pitch and volume
   can be shaped per sentence so serious news sounds serious and good news
   sounds warmer. (Keyword detection is English-only; Tagalog sentences are
   read with the neutral delivery plus the opening / closing shaping.) ---- */

type Mood = "grave" | "concern" | "warm" | "question" | "neutral";

const GRAVE =
  /\b(severe|extreme|catastrophic|devastat\w*|dangerous|danger|life-threatening|evacuat\w*|casualt\w*|fatalit\w*|deadly|emergency|critical|destroyed|worst)\b/i;
const CONCERN =
  /\b(warning|flood\w*|landslide\w*|storm|typhoon|heavy rain\w*|damage\w*|risk|threat\w*|disrupt\w*|delay\w*|shortage|drought|surge|increase[sd]?|rising|worsen\w*|vulnerable|affected|alert)\b/i;
const WARM =
  /\b(improv\w*|recover\w*|safe|stable|clear\w*|relief|good news|positive|decrease[sd]?|easing|subsid\w*|normal|resum\w*|restored|favorable|encouraging)\b/i;

function detectMood(chunk: string): Mood {
  if (/\?$/.test(chunk)) return "question";
  if (GRAVE.test(chunk)) return "grave";
  if (CONCERN.test(chunk)) return "concern";
  if (WARM.test(chunk)) return "warm";
  return "neutral";
}

const jitter = (amount: number) => (Math.random() - 0.5) * amount;

// Per-sentence delivery: [rate, pitch, volume, pause after (ms)]
function deliveryFor(
  mood: Mood,
  chunk: string,
  isFirst: boolean,
  isLast: boolean
): { rate: number; pitch: number; volume: number; pause: number } {
  const endsSentence = /[.!?]$/.test(chunk);
  let d = {
    rate: 1.03 + jitter(0.04),
    pitch: 1 + jitter(0.06),
    volume: 1,
    pause: endsSentence ? 320 : 120,
  };

  switch (mood) {
    case "grave": // slower, lower, heavier pause: "this matters"
      d = { rate: 0.9 + jitter(0.02), pitch: 0.88 + jitter(0.03), volume: 1, pause: 520 };
      break;
    case "concern": // measured and a little lower
      d = { rate: 0.96 + jitter(0.03), pitch: 0.94 + jitter(0.04), volume: 1, pause: 420 };
      break;
    case "warm": // brighter and a touch quicker
      d = { rate: 1.05 + jitter(0.03), pitch: 1.08 + jitter(0.04), volume: 1, pause: 340 };
      break;
    case "question": // lifted, curious
      d = { rate: 1.0, pitch: 1.12, volume: 1, pause: 400 };
      break;
  }

  // Anchor-style open: steady and confident, with a beat before the story starts.
  if (isFirst) d = { rate: 0.97, pitch: 0.95, volume: 1, pause: 550 };

  // Sign-off: slower, softer, resolved.
  if (isLast) d = { rate: 0.93, pitch: 0.92, volume: 0.9, pause: 0 };

  // Mid-sentence clauses should flow, not stall.
  if (!endsSentence && !isFirst && !isLast) d.pause = Math.min(d.pause, 160);

  return d;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

const noopSubscribe = () => () => {};

/* =========================================
   TOOLBAR (Listen + Translate + Download PDF)
========================================= */

const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 32,
  padding: "0 13px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Arial, sans-serif",
  cursor: "pointer",
  // Longhand on purpose: mixing `border` with `borderColor` makes React warn
  // when borderColor is removed on re-render (e.g. when speech stops).
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  background: "#fff",
  color: "#1f2937",
  whiteSpace: "nowrap",
};

function RegionReportActions({
  regionName,
  summary,
  translation,
  getNode,
  style,
}: {
  regionName: string;
  /** the summary currently displayed (English or translated) */
  summary: string;
  translation: Translation;
  /** returns the element whose contents are the A4 document */
  getNode: () => HTMLElement | null;
  style?: CSSProperties;
}) {
  const { lang, translating, error, toggle } = translation;

  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined",
    () => false
  );
  const [speaking, setSpeaking] = useState(false);
  // Which speech run belongs to this toolbar (-1 = none yet)
  const session = useRef(-1);

  // Stop reading when this toolbar goes away (lightbox closed, region changed,
  // language switched, page left).
  useEffect(() => {
    // Chrome loads its voice list lazily; asking early means it's ready when Listen is clicked.
    window.speechSynthesis?.getVoices();

    const stopIfMine = () => {
      if (session.current === speechToken) {
        speechToken++;
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
    };
    window.addEventListener("pagehide", stopIfMine);
    return () => {
      window.removeEventListener("pagehide", stopIfMine);
      stopIfMine();
    };
  }, [regionName, summary, lang]);

  function stop() {
    speechToken++;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function start() {
    const synth = window.speechSynthesis;
    synth.cancel(); // also silences the other toolbar if it was reading
    const token = ++speechToken;
    session.current = token;

    const chunks = toChunks(toSpeakable(regionName, summary, lang));
    const voice = pickVoice(lang);
    const fallbackLang = lang === "tl" ? "fil-PH" : "en-US";
    let i = 0;
    setSpeaking(true);

    const next = () => {
      if (token !== speechToken) return;
      if (i >= chunks.length) {
        setSpeaking(false);
        return;
      }

      const chunk = chunks[i];
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;
      i++;

      const mood = lang === "tl" ? "neutral" : detectMood(chunk);
      const d = deliveryFor(mood, chunk, isFirst, isLast);

      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang ?? fallbackLang;
      if (voice) u.voice = voice;
      u.rate = d.rate;
      u.pitch = d.pitch;
      u.volume = d.volume;

      u.onend = () => {
        if (token === speechToken) window.setTimeout(next, d.pause);
        else if (session.current === token) setSpeaking(false); // replaced by the other toolbar
      };
      u.onerror = () => {
        if (token === speechToken) speechToken++;
        if (session.current === token) setSpeaking(false);
      };
      synth.speak(u);
    };
    next();
  }

  function downloadPdf() {
    const node = getNode();
    if (!node) return;

    const title = `Regional Impact Assessment - ${regionName}`;
    const previousTitle = document.title;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      iframe.remove();
      return;
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.title = previousTitle;
      iframe.remove();
    };

    // The document's own <style> block travels inside node.innerHTML.
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
        `<style>html,body{margin:0;padding:0;background:#fff;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>` +
        `</head><body>${node.innerHTML}` +
        `<style>@page{size:A4 portrait;margin:0}` +
        `.a4-page{width:794px!important;min-height:0!important;margin:0!important;box-shadow:none!important;border:none!important;border-radius:0!important;}</style>` +
        `</body></html>`
    );
    doc.close();

    document.title = title; // becomes the suggested file name in the "Save as PDF" dialog
    window.setTimeout(() => {
      win.addEventListener("afterprint", cleanup);
      win.focus();
      win.print();
      window.setTimeout(cleanup, 60000); // safety net for browsers that never fire afterprint
    }, 300);
  }

  const translateLabel = translating
    ? "Isinasalin..."
    : lang === "tl"
      ? "Show in English"
      : "Isalin sa Tagalog";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <style>{`@keyframes rr-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <button
        type="button"
        onClick={speaking ? stop : start}
        disabled={!supported}
        title={
          !supported
            ? "Read aloud isn't supported in this browser"
            : speaking
              ? "Stop reading"
              : "Read the regional summary aloud"
        }
        aria-label={speaking ? "Stop reading" : "Read the regional summary aloud"}
        aria-pressed={speaking}
        style={{
          ...btnBase,
          ...(speaking ? { background: "#003087", borderColor: "#003087", color: "#fff" } : {}),
          ...(!supported ? { opacity: 0.5, cursor: "not-allowed" } : {}),
        }}
      >
        {speaking ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        )}
        <span style={speaking ? { animation: "rr-pulse 1.2s ease-in-out infinite" } : undefined}>
          {speaking ? "Stop" : "Listen"}
        </span>
      </button>

      <button
        type="button"
        onClick={toggle}
        disabled={translating}
        title={
          lang === "tl"
            ? "Show the regional summary in English"
            : "Translate the regional summary to Tagalog"
        }
        aria-label={
          lang === "tl"
            ? "Show the regional summary in English"
            : "Translate the regional summary to Tagalog"
        }
        aria-pressed={lang === "tl"}
        style={{
          ...btnBase,
          ...(lang === "tl" ? { background: "#e8eefc", borderColor: "#003087", color: "#003087" } : {}),
          ...(translating ? { opacity: 0.6, cursor: "wait" } : {}),
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 8l6 6" />
          <path d="M4 14l6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="M22 22l-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
        <span style={translating ? { animation: "rr-pulse 1.2s ease-in-out infinite" } : undefined}>
          {translateLabel}
        </span>
      </button>

      <button
        type="button"
        onClick={downloadPdf}
        title="Download this report as a PDF (choose “Save as PDF” in the dialog)"
        aria-label="Download this report as a PDF"
        style={{ ...btnBase, background: "#003087", borderColor: "#003087", color: "#fff" }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download PDF
      </button>

      {error && (
        <span
          role="alert"
          style={{
            flexBasis: "100%",
            color: "#b91c1c",
            fontSize: 12,
            fontFamily: "Arial, sans-serif",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

/* =========================================
   ENLARGED VIEW (inside the lightbox)
========================================= */

function RegionReportZoomed({
  regionName,
  summary,
  month,
  translation,
  mapImage,
  chart,
}: {
  regionName: string;
  /** the summary currently displayed (English or translated) */
  summary: string;
  month: string;
  translation: Translation;
  mapImage?: string | null;
  chart?: RainfallChartData | null;
}) {
  const docRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <RegionReportActions
        regionName={regionName}
        summary={summary}
        translation={translation}
        getNode={() => docRef.current}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "8px 14px",
          boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        }}
      />
      <div ref={docRef}>
        <RegionReportDocument regionName={regionName} summary={summary} month={month} mapImage={mapImage} chart={chart} />
      </div>
    </div>
  );
}

/* =========================================
   PANEL (small preview + toolbar)
========================================= */

export default function RegionReportPanel({
  regionName,
  summary,
  month,
  mapImage,
  chart,
}: {
  regionName: string;
  summary: string;
  month: string;
  mapImage?: string | null;
  chart?: RainfallChartData | null;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fit the A4 preview to whatever width the panel has (a fixed zoom cut off the right side).
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.max(0.3, Math.min(1, w / 794)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Translation state lives here so the preview, the lightbox, Listen and
  // Download PDF all show the same language.
  const translation = useTagalogTranslation(regionName, month, summary);
  const shown = translation.displaySummary;

  return (
    <div ref={wrapRef}>
      {/* Sticky so Listen / Translate / Download PDF stay reachable while scrolling the report */}
      <RegionReportActions
        regionName={regionName}
        summary={shown}
        translation={translation}
        getNode={() => previewRef.current}
        style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", padding: "6px 0 10px" }}
      />

      <ZoomableBlock
        label="Click to enlarge"
        zoomedContent={
          <RegionReportZoomed
            regionName={regionName}
            summary={shown}
            month={month}
            translation={translation}
            mapImage={mapImage}
            chart={chart}
          />
        }
      >
        <div ref={previewRef} style={{ width: 794, zoom: scale } as CSSProperties}>
          <RegionReportDocument regionName={regionName} summary={shown} month={month} mapImage={mapImage} chart={chart} />
        </div>
      </ZoomableBlock>
    </div>
  );
}