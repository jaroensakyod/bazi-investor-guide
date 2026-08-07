"use client";

import Link from "next/link";
import { useT } from "./lib/i18n";

export default function HomePage() {
  const t = useT();
  const features = [
    { icon: "🔮", title: t("feat.movers.title"), desc: t("feat.movers.desc") },
    { icon: "🚀", title: t("feat.ipo.title"), desc: t("feat.ipo.desc") },
    { icon: "🗓️", title: t("feat.almanac.title"), desc: t("feat.almanac.desc") },
    { icon: "📑", title: t("feat.report.title"), desc: t("feat.report.desc") },
    { icon: "🏠", title: t("feat.land.title"), desc: t("feat.land.desc") },
    { icon: "📈", title: t("feat.gems.title"), desc: t("feat.gems.desc") },
  ];
  const steps = [
    { n: "1", icon: "📅", title: t("land.step1.title"), desc: t("land.step1.desc") },
    { n: "2", icon: "🃏", title: t("land.step2.title"), desc: t("land.step2.desc") },
    { n: "3", icon: "📈", title: t("land.step3.title"), desc: t("land.step3.desc") },
  ];
  const prices = [
    { id: "free", label: t("land.price.free"), cls: "" },
    { id: "99", label: t("land.price.t99"), cls: "" },
    { id: "490", label: t("land.price.t490"), cls: "hot" },
    { id: "790", label: t("land.price.t790"), cls: "" },
  ];
  const compares = [
    { who: "🧙 ซินแส/หมอดู", line: t("land.compare.sinsean"), ok: false },
    { who: "📊 โบรกเกอร์/บล็อก", line: t("land.compare.broker"), ok: false },
    { who: "☯ ดวงนักลงทุน", line: t("land.compare.us"), ok: true },
  ];

  return (
    <div>
      {/* ── Hero ── */}
      <div className="hero" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 34, marginBottom: 6 }}>{t("hero.title")}</h1>
        <p style={{ maxWidth: 620, margin: "0 auto", fontSize: 15, lineHeight: 1.6 }}>{t("land.pas")}</p>
        <p style={{ color: "#d4af37", fontWeight: 700, fontSize: 14, marginTop: 10 }}>{t("land.stats")}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
          <Link className="btn" href="/demo" style={{ fontSize: 16, padding: "11px 30px" }}>
            {t("land.cta")}
          </Link>
          <Link className="btn" href="/chat" style={{ fontSize: 16, padding: "11px 30px" }}>
            {t("hero.cta2")}
          </Link>
        </div>
      </div>

      {/* ── 3 ขั้นตอน ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 6 }}>
        {steps.map((s) => (
          <div key={s.n} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <p style={{ fontWeight: 700, margin: "6px 0 4px", fontSize: 14.5 }}>
              {s.n}. {s.title}
            </p>
            <p style={{ fontSize: 12, color: "#9a937f", lineHeight: 1.55 }}>{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── เทียบคู่แข่ง ── */}
      <div className="card" style={{ marginTop: 14, borderColor: "#d4af37" }}>
        <h2>🏆 {t("land.compare.title")}</h2>
        {compares.map((c) => (
          <div key={c.who} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #262a34" }}>
            <span style={{ fontSize: 16 }}>{c.ok ? "✅" : "❌"}</span>
            <div>
              <b style={{ fontSize: 13.5 }}>{c.who}</b>
              <p style={{ fontSize: 12, color: "#9a937f", margin: "2px 0 0" }}>{c.line}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── ราคา ── */}
      <div style={{ marginTop: 14 }}>
        <h2 style={{ textAlign: "center" }}>💰 {t("land.price.title")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {prices.map((p) => (
            <div key={p.id} className="card" style={p.cls === "hot" ? { borderColor: "#d4af37", boxShadow: "0 0 14px rgba(212,175,55,.25)" } : undefined}>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{p.label}</p>
              {p.cls === "hot" && <p style={{ fontSize: 11, color: "#d4af37", marginTop: 6 }}>⭐ ขายดี</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 14 }}>
        {features.map((f) => (
          <div key={f.title} className="card">
            <p style={{ fontSize: 22, margin: 0 }}>{f.icon}</p>
            <p style={{ fontWeight: 700, margin: "6px 0 4px", fontSize: 14 }}>{f.title}</p>
            <p style={{ fontSize: 12, color: "#9a937f", lineHeight: 1.55 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#666", marginTop: 18 }}>{t("disclaimer")}</p>
    </div>
  );
}
