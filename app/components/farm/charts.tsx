// Small dependency-free SVG charts (the project has no chart library).
// Hover, keyboard focus or a tap on a column shows a tooltip with its values.
"use client";

import { useId, useState, type PointerEvent, type ReactNode } from "react";

interface Bar { label: string; value: number | null; color?: string; note?: string; /** tooltip heading when the axis label is short or blank */ tip?: string }

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const m = max / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Which column is shown in the tooltip, and the events that change it (mouse, touch, keyboard). */
function useHover() {
  const [hover, setHover] = useState<number | null>(null);
  const props = (i: number) => ({
    onPointerEnter: () => setHover(i),
    onPointerDown: () => setHover(i), // a tap on a touch screen
    onPointerLeave: (e: PointerEvent) => { if (e.pointerType === "mouse") setHover(null); }, // a finger lifting is not leaving
    onFocus: () => setHover(i),
    onBlur: () => setHover(null),
  });
  return { hover, props };
}

function Tooltip({ xPct, yPct, minTopRem, children }: { xPct: number; yPct: number; minTopRem: number; children: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-[#1c2b3a] px-2 py-1 text-xs leading-snug text-white shadow-lg"
      style={{ left: `${clamp(xPct, 12, 88)}%`, top: `max(calc(${yPct}% - 0.5rem), ${minTopRem}rem)` }}>
      {children}
    </div>
  );
}

export function BarChart({ data, unit, title, height = 200, barColor = "#3f96cc" }: {
  data: Bar[]; unit: string; title: string; height?: number; barColor?: string;
}) {
  const id = useId();
  const { hover, props } = useHover();
  const W = 640, padL = 44, padB = 26, padT = 20, padR = 8;
  const max = nice(Math.max(0, ...data.map(d => d.value ?? 0)));
  const iw = W - padL - padR, ih = height - padT - padB;
  const bw = iw / data.length;
  const ticks = [0, 0.5, 1].map(f => f * max);
  const text = (d: Bar) => `${d.tip ?? d.label}: ${d.value == null ? "no data" : `${r1(d.value)} ${unit}`}${d.note ? `, ${d.note}` : ""}`;
  const hd = hover == null ? null : data[hover];
  const hh = hd?.value == null ? 0 : (hd.value / max) * ih;
  return (
    <figure className="m-0">
      <figcaption id={id} className="mb-1 text-sm font-bold text-[#1c2b3a]">{title}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} role="group" aria-labelledby={id} className="block h-auto w-full">
          {ticks.map(t => {
            const y = padT + ih - (t / max) * ih;
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e3e8ee" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#5b6672">{Math.round(t * 100) / 100}</text>
              </g>
            );
          })}
          <text x={padL} y={11} fontSize="11" fill="#5b6672">{unit}</text>
          {hover != null && <rect x={padL + hover * bw} y={padT} width={bw} height={ih} fill="#1c2b3a" opacity={0.07} />}
          {data.map((d, i) => {
            const h = d.value == null ? 0 : (d.value / max) * ih;
            const x = padL + i * bw + bw * 0.15;
            return (
              <g key={d.label + i}>
                <rect x={x} y={padT + ih - h} width={bw * 0.7} height={h} rx={2} fill={d.color ?? barColor} opacity={hover === i ? 0.75 : 1} />
                <text x={x + bw * 0.35} y={height - 8} textAnchor="middle" fontSize="11" fill="#5b6672">{d.label}</text>
              </g>
            );
          })}
          {/* invisible full-height columns on top: easy to hit even for short or empty bars */}
          {data.map((d, i) => (
            <rect key={i} x={padL + i * bw} y={padT} width={bw} height={ih} fill="transparent" tabIndex={0} role="img" aria-label={text(d)} className="outline-none" {...props(i)} />
          ))}
        </svg>
        {hd && (
          <Tooltip xPct={((padL + hover! * bw + bw / 2) / W) * 100} yPct={((padT + ih - hh) / height) * 100} minTopRem={hd.note ? 3.4 : 2.4}>
            <div className="font-bold">{hd.tip ?? hd.label}</div>
            <div>{hd.value == null ? "No data" : `${r1(hd.value)} ${unit}`}</div>
            {hd.note && <div className="text-[#c9d4df]">{hd.note}</div>}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

export function LineChart({ data, unit, title, height = 180, color = "#d9622b", extra }: {
  data: { label: string; value: number | null }[]; unit: string; title: string; height?: number; color?: string;
  extra?: { label: string; value: number | null }[];
}) {
  const id = useId();
  const { hover, props } = useHover(); // hooks come before the early return below
  const W = 640, padL = 44, padB = 26, padT = 20, padR = 8;
  const vals = [...data, ...(extra ?? [])].map(d => d.value).filter((v): v is number => v != null);
  if (!vals.length) return <p className="text-sm text-[#5b6672]">No data for {title.toLowerCase()}.</p>;
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const iw = W - padL - padR, ih = height - padT - padB;
  const X = (i: number) => padL + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const Y = (v: number) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const path = (pts: { value: number | null }[]) =>
    pts.map((p, i) => (p.value == null ? "" : `${i === 0 || pts[i - 1].value == null ? "M" : "L"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`)).join(" ");
  const step = data.length === 1 ? iw : iw / (data.length - 1);
  const show = (v: number | null | undefined) => (v == null ? "no data" : `${r1(v)} ${unit}`);
  const text = (i: number) => extra
    ? `${data[i].label}: daily high ${show(data[i].value)}, daily low ${show(extra[i]?.value)}`
    : `${data[i].label}: ${show(data[i].value)}`;
  const hv = hover == null ? null : data[hover];
  const topY = hover == null ? 0 : Math.min(...[data[hover].value, extra?.[hover]?.value].filter((v): v is number => v != null).map(Y), padT + ih);
  return (
    <figure className="m-0">
      <figcaption id={id} className="mb-1 text-sm font-bold text-[#1c2b3a]">{title}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} role="group" aria-labelledby={id} className="block h-auto w-full">
          {[lo, (lo + hi) / 2, hi].map(t => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="#e3e8ee" />
              <text x={padL - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6672">{Math.round(t)}</text>
            </g>
          ))}
          <text x={padL} y={11} fontSize="11" fill="#5b6672">{unit}</text>
          {hover != null && <line x1={X(hover)} x2={X(hover)} y1={padT} y2={padT + ih} stroke="#9aa3ad" strokeDasharray="3 3" />}
          {extra && <path d={path(extra)} fill="none" stroke="#3f96cc" strokeWidth={2} />}
          <path d={path(data)} fill="none" stroke={color} strokeWidth={2} />
          {data.map((d, i) => (
            <g key={d.label + i}>
              {d.value != null && <circle cx={X(i)} cy={Y(d.value)} r={hover === i ? 5 : 3} fill={color} stroke={hover === i ? "#fff" : "none"} strokeWidth={1.5} />}
              {hover === i && extra?.[i]?.value != null && <circle cx={X(i)} cy={Y(extra[i].value as number)} r={5} fill="#3f96cc" stroke="#fff" strokeWidth={1.5} />}
              {(data.length <= 14 || i % Math.ceil(data.length / 12) === 0) && (
                <text x={X(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#5b6672">{d.label}</text>
              )}
            </g>
          ))}
          {data.map((d, i) => (
            <rect key={i} x={X(i) - step / 2} y={padT} width={step} height={ih} fill="transparent" tabIndex={0} role="img" aria-label={text(i)} className="outline-none" {...props(i)} />
          ))}
        </svg>
        {hv && (
          <Tooltip xPct={(X(hover!) / W) * 100} yPct={(topY / height) * 100} minTopRem={extra ? 4.4 : 3}>
            <div className="font-bold">{hv.label}</div>
            {extra ? (
              <>
                <div><span style={{ color }}>&#9632;</span> Daily high: {show(hv.value)}</div>
                <div><span style={{ color: "#3f96cc" }}>&#9632;</span> Daily low: {show(extra[hover!]?.value)}</div>
              </>
            ) : (
              <div>{show(hv.value)}</div>
            )}
          </Tooltip>
        )}
      </div>
      {extra && (
        <div className="mt-1 flex gap-4 text-xs text-[#5b6672]">
          <span><span style={{ color }}>&#9632;</span> Daily high</span>
          <span><span style={{ color: "#3f96cc" }}>&#9632;</span> Daily low</span>
        </div>
      )}
    </figure>
  );
}
