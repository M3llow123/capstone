// ── Expected provinces per region (used by the CSV schema check) ────────
// Keys are the SAME ids used in app/regions/[id]/edit/page.tsx ("1" … "16").
// If PAGASA's data team spells a province differently, add it to ALIASES
// (or fix the name here) — nothing else needs to change.

export const REGION_PROVINCES: Record<string, { name: string; provinces: string[] }> = {
  "1":  { name: "Region 1 Ilocos Region",         provinces: ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"] },
  "2":  { name: "Region 2 Cagayan Valley",        provinces: ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"] },
  "3":  { name: "CAR (Cordillera Administrative Region)", provinces: ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"] },
  "4":  { name: "Region 3 Central Luzon",         provinces: ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"] },
  "5":  { name: "Region 4A CALABARZON",           provinces: ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"] },
  "6":  { name: "Region 4B MIMAROPA",             provinces: ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"] },
  "7":  { name: "Region 5 Bicol Region",          provinces: ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"] },
  "8":  { name: "Region 6 Western Visayas",       provinces: ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"] },
  "9":  { name: "Region 7 Central Visayas",       provinces: ["Bohol", "Cebu", "Negros Oriental", "Siquijor"] },
  "10": { name: "Region 8 Eastern Visayas",       provinces: ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"] },
  "11": { name: "Region 9 Zamboanga Peninsula",   provinces: ["City of Isabela", "Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"] },
  "12": { name: "Region 10 Northern Mindanao",    provinces: ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"] },
  "13": { name: "Region 11 Davao Region",         provinces: ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"] },
  "14": { name: "Region 12 SOCCSKSARGEN",         provinces: ["Cotabato", "Cotabato City", "Sarangani", "South Cotabato", "Sultan Kudarat"] },
  "15": { name: "Region 13 CARAGA",               provinces: ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"] },
  "16": { name: "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)", provinces: ["Basilan", "Lanao del Sur", "Maguindanao", "Sulu", "Tawi-Tawi"] },
};

// Other spellings that should be treated as the canonical province name.
// Left side is normalised (lowercase, letters/digits only, single spaces).
const ALIASES: Record<string, string> = {
  "compostela valley": "Davao de Oro",
  "north cotabato": "Cotabato",
  "western samar": "Samar",
  "mt province": "Mountain Province",
  "mt. province": "Mountain Province",
  "dinagat": "Dinagat Islands",
  "tawi tawi": "Tawi-Tawi",
};

/** lowercase, punctuation → space, collapse spaces ("Tawi-Tawi" → "tawi tawi"). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// normalised name → canonical name, for every province of every region
const ALL: Record<string, string> = {};
const OWNER: Record<string, string> = {}; // normalised name → region id
for (const [rid, r] of Object.entries(REGION_PROVINCES)) {
  for (const p of r.provinces) {
    ALL[normalizeName(p)] = p;
    OWNER[normalizeName(p)] = rid;
  }
}
for (const [alias, canon] of Object.entries(ALIASES)) {
  const key = normalizeName(alias);
  ALL[key] = canon;
  OWNER[key] = OWNER[normalizeName(canon)];
}

/** Canonical province name for a CSV header, or null if it is not a known province. */
export function canonicalProvince(header: string): string | null {
  return ALL[normalizeName(header)] ?? null;
}

/** Which region a (canonical or alias) province belongs to, or null if unknown. */
export function regionOfProvince(header: string): string | null {
  return OWNER[normalizeName(header)] ?? null;
}
