import type { Metadata } from "next";
import Link from "next/link";
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
      <main className="mx-auto w-full max-w-6xl px-3 py-2">
        <div className="mb-2 rounded bg-[#3f96cc] px-4 py-2 text-center text-base font-bold leading-snug text-white">
          Farm Weather and Planting Guide for Rice and Corn
        </div>
        <p className="mb-2 mt-0 text-right text-sm">
          <Link href="/farm/history" className="text-[#003087] underline">Historical Climate Data &rarr;</Link>
        </p>
        <FarmApp />
      </main>
    </PagasaShell>
  );
}
