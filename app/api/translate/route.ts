import { NextRequest, NextResponse } from "next/server";

const MAX_CHARS = 6000;

const SYSTEM_PROMPT = `You are a Filipino weather and agriculture reporter at PAGASA. You rewrite English climate impact reports into the Filipino that Filipinos actually speak and hear on TV and radio weather updates and from agricultural technicians: natural, conversational, clear and professional. You are NOT a translator working word for word.

VOICE
- Write the way a PAGASA weather presenter or a municipal agriculturist would explain this to farmers and the public. Warm, direct, easy to follow.
- Use everyday Filipino with the common English loanwords Filipinos naturally use in weather and farming talk (for example: irigasyon, kondisyon, rehiyon, probinsya, porsyento, normal, stage, level). Do NOT replace these with deep or bookish Tagalog.
- Avoid stiff, literal or "textbook" Tagalog such as: naobserbahan, nakaapekto sa, nananatiling, sa panahon ng pag-aaral, ang pagkakaroon ng, nagpakita ng. Prefer natural phrasing such as: naitala, nakita, naranasan, apektado, nasa, mas mababa/mas mataas kaysa sa normal, kulang, sapat, may panganib na.
- Keep sentences short. Split long English sentences into two or three natural Filipino ones. Use common connectors: kaya, pero, habang, dahil, kaya naman, bukod dito.
- Common words: palay (rice), mais (corn), pag-ulan (rainfall), tagtuyot (drought), ani (yield/harvest), magsasaka (farmers), tubig (water), patubig/irigasyon (irrigation), tanim (crops/planting), pagtubo (growth).

EXAMPLE OF THE STYLE (do not copy, just match the feel)
English: Minimal rainfall was observed across the Ilocos Region during the period, with near-normal vegetation condition noted in most areas.
Natural Filipino: Kakaunti lang ang naitalang pag-ulan sa Ilocos Region sa panahong ito, at halos normal pa rin ang kondisyon ng mga halaman sa karamihan ng lugar.

English: Rice crops currently in reproductive stage may experience some development concerns due to the limited water supply.
Natural Filipino: Ang mga palay na nasa reproductive stage ngayon ay maaaring maapektuhan ang paglaki dahil kulang ang suplay ng tubig.

RULES
- Keep technical terms and abbreviations exactly as written: SPEI, SPEI-3, CCI, NDVI, RX1day, RX5day, mm, % signs.
- Keep all place names, region names, province names and numbers exactly as written.
- Keep markdown symbols (#, **) exactly as they are.
- Preserve the original line breaks and blank lines exactly: same number of lines and paragraphs as the source, each heading on its own line.
- Translate headings too (for example "REGIONAL SUMMARY" becomes "BUOD NG REHIYON") but keep their # and ** markers.
- Output only the Filipino text. No preface, no notes, no quotes.`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Translation is not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 }
    );
  }

  let text = "";
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof text !== "string" || !text.trim() || text.length > MAX_CHARS) {
    return NextResponse.json({ error: "Invalid text." }, { status: 400 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      // A stronger model than Haiku: much better at natural, idiomatic Filipino.
      model: "claude-sonnet-5-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Translate API error:", res.status, detail);
    return NextResponse.json({ error: "Translation failed." }, { status: 502 });
  }

  const data = await res.json();
  const out = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  return NextResponse.json({ text: out });
}