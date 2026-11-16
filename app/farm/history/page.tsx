import type { Metadata } from "next";
import Link from "next/link";
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
      <main className="mx-auto w-full max-w-6xl px-3 py-2">
        <div className="mb-2 rounded bg-[#3f96cc] px-4 py-2 text-center text-base font-bold leading-snug text-white">
          Historical Climate Data behind the Planting Calendar
        </div>
        <p className="mb-2 mt-0 text-sm">
          <Link href="/farm" className="text-[#003087] underline print:hidden">&larr; Back to Farm Guide</Link>
        </p>
        <HistoryApp />
      </main>
    </PagasaShell>
  );
}
