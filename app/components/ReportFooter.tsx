/* eslint-disable @next/next/no-img-element */

// "For Particulars" contact block + the standard GOVPH footer, shown at the bottom of the public report.

const CONTACT = {
  name: "JORYBELL A. MASALLO",
  lines: [
    "Chief, Impact Assessment and Applications Section (IAAS)",
    "Climatology and Agrometeorology Division (CAD), DOST-PAGASA",
    "Trunkline No.: (02)8284-0800 (Loc. 4910)",
    "E-mail: iaascad17@gmail.com",
  ],
};

const GOV_LINKS: [string, string][] = [
  ["Office of the President", "https://op-proper.gov.ph/"],
  ["Office of the Vice President", "https://ovp.gov.ph/"],
  ["Senate of the Philippines", "https://www.senate.gov.ph/"],
  ["House of Representatives", "https://www.congress.gov.ph/"],
  ["Supreme Court", "https://sc.judiciary.gov.ph/"],
  ["Court of Appeals", "https://ca.judiciary.gov.ph/"],
  ["Sandiganbayan", "https://sb.judiciary.gov.ph/"],
];

const ABOUT_LINKS: [string, string][] = [
  ["GOV.PH", "https://www.gov.ph/"],
  ["Open Data Portal", "https://data.gov.ph/"],
  ["Official Gazette", "https://www.officialgazette.gov.ph/"],
];

const heading: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "#444",
  margin: "0 0 14px",
};
const text: React.CSSProperties = { fontSize: 13, lineHeight: "22px", color: "#555", margin: 0 };
const link: React.CSSProperties = { display: "block", fontSize: 13, lineHeight: "22.5px", color: "#555", textDecoration: "none" };

function Links({ items }: { items: [string, string][] }) {
  return (
    <>
      {items.map(([label, href]) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={link}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          {label}
        </a>
      ))}
    </>
  );
}

export default function ReportFooter() {
  return (
    <div style={{ marginTop: "auto", flexShrink: 0 }}>
      {/* contact block */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap');`}</style>
      {/* full-width white band; the text itself stays aligned with the report content */}
      <div style={{ background: "#fff", fontFamily: "'Source Sans Pro', 'Segoe UI', Arial, sans-serif" }}>
        <div style={{ padding: "40px 24px 30px", maxWidth: 940 }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, color: "#333", margin: "0 0 34px" }}>For Particulars, please contact:</h3>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#333", lineHeight: "37px" }}>{CONTACT.name}</div>
          {CONTACT.lines.map((l) => (
            <div key={l} style={{ fontSize: 17, lineHeight: "37.5px", color: "#333" }}>{l}</div>
          ))}
        </div>
      </div>

      {/* GOVPH footer */}
      <footer style={{ background: "#efefef", padding: "30px 24px 36px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 36px", alignItems: "flex-start", maxWidth: 1400 }}>
          <img src="/footer-seal.png" alt="" width={170} style={{ display: "block", flexShrink: 0 }} />

          <div style={{ flex: "1 1 190px", minWidth: 170 }}>
            <h4 style={heading}>Republic of the Philippines</h4>
            <p style={text}>All content is in the public domain unless otherwise stated.</p>
          </div>

          <div style={{ flex: "1 1 220px", minWidth: 190 }}>
            <h4 style={heading}>About GOVPH</h4>
            <p style={{ ...text, marginBottom: 14 }}>
              Learn more about the Philippine government, its structure, how government works and the people behind it.
            </p>
            <Links items={ABOUT_LINKS} />
          </div>

          <div style={{ flex: "1 1 190px", minWidth: 170 }}>
            <h4 style={heading}>Government Links</h4>
            <Links items={GOV_LINKS} />
          </div>
        </div>
      </footer>
    </div>
  );
}
