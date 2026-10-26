"use client";

/**
 * Click-to-zoom helpers for the public report page.
 *
 *  - <ZoomableImage>  drop-in replacement for <img>; click opens it in a lightbox
 *  - <ZoomableBlock>  makes any content clickable and shows `zoomedContent`
 *                     in the lightbox (used for the regional report document)
 *  - <Lightbox>       the dimmed overlay + white "X" button
 *
 * The lightbox is rendered through a portal into <body>. That matters here:
 * the report page's side panels use `transform`, `overflow: hidden` and CSS
 * `zoom`, all of which would clip or misplace a `position: fixed` overlay if
 * it were rendered in place.
 *
 * Close with: the X button, clicking the dark backdrop, or the Escape key.
 */

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* =========================================
   LIGHTBOX
========================================= */

export function Lightbox({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    // Stop the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "zoom-out",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        autoFocus
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          width: 36,
          height: 36,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          zIndex: 1,
          boxShadow: "0 2px 8px rgba(0,0,0,.35)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3 3 L17 17 M17 3 L3 17"
            stroke="#000"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Clicks on the zoomed content itself shouldn't close the lightbox */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          display: "flex",
          cursor: "default",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* =========================================
   ZOOMABLE IMAGE
========================================= */

export default function ZoomableImage({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const onKeyDown = (e: KeyboardEvent<HTMLImageElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      {/* Plain <img> on purpose: uploads are base64 data URLs, which next/image can't optimize */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        title="Click to enlarge"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ ...style, cursor: "zoom-in" }}
      />

      {open && (
        <Lightbox onClose={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            style={{
              display: "block",
              width: "auto",
              height: "auto",
              maxWidth: "calc(100vw - 48px)",
              maxHeight: "calc(100vh - 48px)",
              objectFit: "contain",
              background: "#fff",
              boxShadow: "0 8px 32px rgba(0,0,0,.45)",
            }}
          />
        </Lightbox>
      )}
    </>
  );
}

/* =========================================
   ZOOMABLE BLOCK
   (for non-image content, e.g. the A4 regional report)
========================================= */

export function ZoomableBlock({
  children,
  zoomedContent,
  label = "Click to enlarge",
}: {
  children: ReactNode;
  zoomedContent: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title={label}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ cursor: "zoom-in" }}
      >
        {children}
      </div>

      {open && (
        <Lightbox onClose={close}>
          <div
            style={{
              background: "#fff",
              overflow: "auto",
              maxWidth: "calc(100vw - 48px)",
              maxHeight: "calc(100vh - 48px)",
              boxShadow: "0 8px 32px rgba(0,0,0,.45)",
            }}
          >
            {zoomedContent}
          </div>
        </Lightbox>
      )}
    </>
  );
}
