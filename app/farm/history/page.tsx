import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import HistoryApp from "../../components/farm/HistoryApp";
import PagasaShell from "../../components/PagasaShell";

export const metadata: Metadata = {
  title: "Historical Climate Data | PAGASA Farm Guide",
  description: "The historical weather data (Open-Meteo, ERA5) behind the planting calendar, with source details and downloads.",
};

// Public page, like /farm. Evidence for the planting calendar: source, request URL, tables, charts and CSV downloads.
export default function FarmHistoryPage() {
  return (
    <PagasaShell active="history">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr { break-inside: avoid; }
          a { color: inherit; }
        }
      `}</style>
      <main className="m-3">
        <div className="mb-6 rounded bg-[#3f96cc] px-4 py-3 text-center text-base font-bold leading-snug text-white">
          Climate Impact Assessment for Philippine Agriculture
        </div>
        <header className="mb-6 flex flex-col gap-4 border-b border-[#d5dde5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[#526477]">PAGASA · Agri-weather</p>
            <h1 className="m-0 mt-1 text-2xl font-bold leading-tight tracking-tight text-[#172b3a] sm:text-3xl">
              Historical climate data
            </h1>
            <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-[#526477]">
              Explore the historical weather behind the planting calendar, with source details and downloadable data.
            </p>
          </div>
          <Link
            href="/farm"
            className="print:hidden inline-flex min-h-10 items-center justify-center gap-2 self-start border border-[#c6d1dc] bg-white px-3 py-2 text-sm font-semibold text-[#17476b] hover:bg-[#f4f7f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b] sm:self-auto"
          >
            <ArrowLeft size={15} aria-hidden /> Farm guide
          </Link>
        </header>
        <HistoryApp />
      </main>
    </PagasaShell>
  );
}
