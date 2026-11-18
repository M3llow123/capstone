import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FarmApp from "../components/farm/FarmApp";
import PagasaShell from "../components/PagasaShell";

export const metadata: Metadata = {
  title: "Farm Weather and Planting Guide | PAGASA",
  description: "Planting calendar and weather forecast for rice and corn farms in the Philippines.",
};

// Public page (farmers, LGUs, general public). The PAGASA admin area stays behind login.
export default function FarmPage() {
  return (
    <PagasaShell active="farm">
      <main className="m-3">
        <div className="mb-6 rounded bg-[#3f96cc] px-4 py-3 text-center text-base font-bold leading-snug text-white">
          Climate Impact Assessment for Philippine Agriculture
        </div>
        <header className="mb-6 flex flex-col gap-4 border-b border-[#d5dde5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[#526477]">PAGASA · Agri-weather</p>
            <h1 className="m-0 mt-1 text-2xl font-bold leading-tight tracking-tight text-[#172b3a] sm:text-3xl">
              Farm weather and planting guide
            </h1>
            <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-[#526477]">
              Local forecasts and climate-based planting guidance for rice and corn.
            </p>
          </div>
          <Link
            href="/farm/history"
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start border border-[#c6d1dc] bg-white px-3 py-2 text-sm font-semibold text-[#17476b] hover:bg-[#f4f7f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b] sm:self-auto"
          >
            Historical climate data <ArrowRight size={15} aria-hidden />
          </Link>
        </header>
        <FarmApp />
      </main>
    </PagasaShell>
  );
}
