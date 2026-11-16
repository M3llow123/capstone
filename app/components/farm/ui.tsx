"use client";
import type { ReactNode } from "react";

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded border border-[#dde3ea] bg-white p-3 shadow-sm">
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h3 className="m-0 text-sm font-bold text-[#1c2b3a]">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded border border-[#dde3ea] bg-white p-4 text-sm text-[#5b6672]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3f96cc] border-t-transparent" />
      {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded border border-[#d32f2f] bg-[#fdecea] p-4 text-sm text-[#7a1c1c]">
      <p className="m-0 font-bold">We could not load this right now.</p>
      <p className="m-0 mt-1">{message}</p>
      <p className="m-0 mt-1">Your other pages still work. Please try again in a few minutes.</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded border border-[#d32f2f] bg-white px-3 py-1 text-[#d32f2f]">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-[#ccd4df] bg-white p-6 text-center text-sm text-[#5b6672]">{children}</div>;
}

export function Badge({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return <span className="inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: bg, color: fg }}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const c = tone === "warn" ? "border-[#ef8a1f] bg-[#fff6e8] text-[#6b3d00]" : "border-[#9cc7e4] bg-[#eef6fb] text-[#1c4a69]";
  return <p role="note" className={`m-0 rounded border px-3 py-2 text-xs leading-snug ${c}`}>{children}</p>;
}
/** Grey placeholder block. Sizes are set by the caller so a skeleton matches the final layout and nothing jumps. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-[#e3e8ee] ${className}`} />;
}

/** A card-shaped skeleton: optional heading bar plus `lines` text lines. Announces loading once for screen readers. */
export function CardSkeleton({ title = true, lines = 4, label = "Loading..." }: { title?: boolean; lines?: number; label?: string }) {
  return (
    <section role="status" aria-busy="true" aria-label={label} className="rounded border border-[#dde3ea] bg-white p-3 shadow-sm">
      {title && <Skeleton className="mb-3 h-4 w-40" />}
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />)}
      </div>
    </section>
  );
}

/** The Planting Calendar layout (12 month tiles + detail card + chart card), drawn before the data arrives. */
export function CalendarSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading planting calendar" className="space-y-3">
      <section className="rounded border border-[#dde3ea] bg-white p-3 shadow-sm">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-2 h-9 w-full" />
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </section>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <CardSkeleton lines={7} />
        <CardSkeleton lines={9} />
      </div>
    </div>
  );
}
