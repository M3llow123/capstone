"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Sidebar dropdown: "Audit Log" -> "Audit Log" page.
// Uses the .side-parent / .side-link classes that every page's sidebar already defines.
export default function AuditLogNav() {
  const router = useRouter();
  const pathname = usePathname();
  const onAuditPage = pathname?.startsWith("/audit-log") ?? false;
  const [open, setOpen] = useState(onAuditPage);

  return (
    <>
      <div className="side-parent" onClick={() => setOpen(p => !p)} style={{ marginTop: 2 }}>
        <span>Audit Log</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && (
        <div
          className={`side-link${onAuditPage ? " active" : ""}`}
          onClick={() => router.push("/audit-log")}
        >
          Audit Log
        </div>
      )}
    </>
  );
}
