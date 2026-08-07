"use client";

import { useEffect, useState } from "react";

/* ═══════════ ข้อมูล ═══════════ */
type ReportData = {
  persona: { name: string; emoji: string; bandLabel: string; style: string; strengths?: string; weaknesses?: string };
  trading: { label: string; allowed: string; split: { cold: number; fast: number; emergency: number }; reason: string };
  principle: { band: string; mode: string; desc: string; supplementElement: string; outputElement: string; excessElement?: string; excessCount?: number; excessNote?: string };
  strengthen: { element: string; businessHint: string; wealth: string };
  avoid: string[];
  elementBalance: Array<{ element: string; pct: number; count?: number }>;
  instruments: { cold: string[]; fast: string[]; emergency: string[] };
  monthAdvice: { element?: string; fit?: string; text: string };
  auspiciousDays: { month: { goodDayCount: number; goodDays: Array<{ date: string }>; avoidDayCount: number; avoidDays: Array<{ date: string }> } };
  timeline: Array<{ ageRange: string; verdict: string; advice: string }>;
  categories: Array<{ label: string; items: Array<{ ticker: string; name: string; element: string; fit: string; stockTier: string }> }>;
  thPicks: { benchmark: { changePct?: number | null }; picks: Array<{ ticker: string; element: string; stockTier: string; score: number; reasons: string[] }> };
  usPicks: { picks: Array<{ ticker: string; element: string; stockTier: string; score: number; reasons: string[] }> };
  narrative: Partial<Record<string, string>>;
  book: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6", { intro: string; body: string; summary: string; picks: Record<string, string> }>>;
  disclaimer: string;
  generatedAt: string;
};

const EL: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };
const TIER_ICON: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉", base: "📦" };
const TIER_NAME: Record<string, string> = { gold: "VIP เทียร์ 1", silver: "PRO เทียร์ 2", bronze: "FREE เทียร์ 3", base: "INFO เทียร์ 4" };
const VMETA: Record<string, { label: string; color: string; tint: string }> = {
  invest: { label: "ลงทุนเต็มที่", color: "#1e6f3e", tint: "#e8f3ea" },
  accumulate: { label: "สะสม/ถือ", color: "#b8860b", tint: "#f7f1e2" },
  avoid: { label: "หลีกเลี่ยง", color: "#9b2c2c", tint: "#f9ecec" },
  "no-risk": { label: "ห้ามเสี่ยง", color: "#6b1f1f", tint: "#f3e3e3" },
};
const FIT_LABEL: Record<string, string> = { good: "ตรงดวง", drain: "ดูดพลัง", avoid: "ขัดดวง", neutral: "กลาง" };

export default function PrintReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const params = new URLSearchParams({ birthDate: p.get("birthDate") || "1993-11-24", birthTime: p.get("birthTime") || "15:12", gender: p.get("gender") || "male", province: p.get("province") || "Bangkok" });
    fetch(`/api/report-html-data?${params}`)
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j.data) : setErr(j.error ?? "โหลดไม่สำเร็จ")))
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div style={{ padding: 40, textAlign: "center", color: "#c00" }}>{err}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}>⏳ กำลังคำนวณดวง + เขียนคำอธิบาย...</div>;

  const d = data;
  const tier = new URLSearchParams(window.location.search).get("tier") || "790";
  const maxSection = { free: 0, "99": 2, "490": 4, "790": 6 }[tier] ?? 4;
  const donut = (segs: Array<{ pct: number; color: string }>, size = 170) => (
    <div className="donut-wrap"><div className="donut" style={{ width: size, height: size, background: `conic-gradient(${segs.filter((s) => s.pct > 0).map((s) => `${s.color} 0 ${s.pct}%`).join(", ")})` }}><div className="donut-hole" style={{ width: size * 0.62, height: size * 0.62 }} /></div></div>
  );
  const bars = (items: Array<{ label: string; value: number; color: string }>) => (
    <div className="bars">{items.map((it) => (<div key={it.label} className="bar-col"><div className="bar" style={{ height: `${Math.max(4, it.value * 7)}px`, background: it.color }} /><span>{it.label}</span><em>{it.value}</em></div>))}</div>
  );
  const phaseOf = (s: number, e: number) => d.timeline.filter((t) => { const a = parseInt((t.ageRange.split("–")[0] || t.ageRange.split("-")[0] || "0"), 10); return a >= s && a < e; });

  /** โครง ภาค: ปก → intro → body (LLM ยาว) → ข้อมูลสนับสนุน → การ์ดคำแนะนำ → สรุป */
  const part = (num: keyof ReportData["book"], title: string, subtitle: string, dataNode: React.ReactNode, pickSource?: Array<{ ticker: string; element: string; tier: string; extra?: string }>) => {
    const p = d.book[num];
    const visible = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6 }[num] <= maxSection;
    if (!visible) return (
      <section className="page"><div className="locked"><b>ภาคที่ {num} — {title}</b><div>🔒 เนื้อหาส่วนนี้ถูกจำกัด — ปลดล็อกด้วยฉบับที่สูงขึ้น</div></div></section>
    );
    const picks = pickSource?.slice(0, 8) ?? [];
    return (
      <section className="page">
        <div className="part-banner"><span>ภาคที่ {num}</span><h1>{title}</h1><p>{subtitle}</p></div>
        {p?.intro && <p className="intro">{p.intro}</p>}
        {p?.body && <div className="prose">{p.body}</div>}
        <div className="evidence">{dataNode}</div>
        {picks.length > 0 && p?.picks && Object.keys(p.picks).length > 0 && (
          <div className="picks">
            <h3>คำอธิบายรายตัว</h3>
            {picks.map((pk) => {
              const explain = p?.picks?.[pk.ticker];
              return (
                <div key={pk.ticker} className="pick-card">
                  <div className="pick-head">
                    <b>{pk.ticker}</b>
                    <span className="chip" style={{ background: EL[pk.element] }}>{pk.element}</span>
                    <span className="chip gold-chip">{TIER_ICON[pk.tier]} {TIER_NAME[pk.tier] ?? pk.tier}</span>
                    {pk.extra && <span className="chip">{pk.extra}</span>}
                  </div>
                  <p>{explain ?? "—"}</p>
                </div>
              );
            })}
          </div>
        )}
        {p?.summary && <div className="summary-box"><b>สิ่งที่คุณต้องทำจากภาคนี้</b><p>{p.summary}</p></div>}
      </section>
    );
  };

  return (
    <div className="print-shell">
      <div className="no-print toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
        <span>เลือก "บันทึกเป็น PDF" · A4 · ขอบ: ตั้งค่าเริ่มต้น</span>
      </div>

      {/* ═══ ปก ═══ */}
      <section className="cover">
        <div className="cover-top">
          <div>☯ ดวงนักลงทุน · ฉบับสถาบัน</div>
          <h1>หนังสือการลงทุนคู่ดวง</h1>
          <p>6 ภาค · อ่านจบรู้เรื่อง — ดวง 60 กะจื่อ × หุ้น/สินทรัพย์จริง × แผนที่ชีวิตทั้งชีวิต</p>
          <small>ฉบับ {maxSection >= 6 ? "VIP ฉบับเต็ม" : maxSection >= 4 ? "PRO" : maxSection >= 2 ? "ฉบับสรุป" : "ตัวอย่าง"} · {d.generatedAt}</small>
        </div>
        <div className="cover-ring">{donut(d.elementBalance.map((e) => ({ pct: e.pct, color: EL[e.element] ?? "#888" })), 210)}</div>
        <div className="cover-persona">
          <div className="persona-emoji">{d.persona.emoji}</div>
          <div className="persona-name">{d.persona.name}</div>
          <div className="persona-sub">{d.persona.bandLabel} · {d.persona.style} · เทรด: {d.trading.label}</div>
        </div>
        <div className="cover-foot">{d.disclaimer}</div>
      </section>

      {/* ═══ สารบัญ + บทนำ ═══ */}
      <section className="page">
        <h2 className="chap-head">สารบัญ</h2>
        {[
          ["ภาคที่ 1", "มุมมองดวง — กำลังดิถี ธาตุในดวง และความหมายต่อการเงิน"],
          ["ภาคที่ 2", "การจัดสรรเงิน — 70:10:20 และเครื่องมือของแต่ละกอง"],
          ["ภาคที่ 3", "พอร์ตเด่น — หุ้นที่ตรงดวงที่สุด พร้อมเหตุผลรายตัว"],
          ["ภาคที่ 4", "สินค้าแนะนำ — สินทรัพย์ที่ควรถือ พร้อมเหตุผลรายตัว"],
          ["ภาคที่ 5", "แผนที่ชีวิต — วัยจร 0-80+ ปี: ลงทุนเมื่อไหร่ ระวังเมื่อไหร่"],
          ["ภาคที่ 6", "ฉบับเดือนนี้ — ธาตุเดือน ปฏิทินมงคล แผนปฏิบัติรายเดือน"],
        ].map(([n, t]) => (<div key={n} className="toc-row"><b>{n}</b><span>{t}</span></div>))}
        <h2 className="chap-head">บทนำ — วิธีอ่านหนังสือเล่มนี้</h2>
        <p className="lede">หนังสือ 6 ภาคนี้สร้างจากข้อมูลจริงของคุณเท่านั้น: ดวงคำนวณด้วยตำรา 60 กะจื่อ (deterministic) × ข้อมูลตลาดจริง 5,958 หุ้น 27 ตลาด × ตารางธาตุซินแส — อ่านเรียงภาคเพื่อความเข้าใจสูงสุด</p>
        <ul className="gloss-mini">
          <li><b>ธาตุ</b> — พลัง 5 ชนิด (ไม้/ไฟ/ดิน/ทอง/น้ำ) — หุ้น/ธุรกิจ/สินทรัพย์มีธาตุของตัวเอง</li>
          <li><b>กำลังดิถี</b> — อ่อน = เสริม อย่าไล่ลาภ · แข็ง = ถ่ายเท กล้าลงทุน</li>
          <li><b>ธาตุลาภ</b> — ธาตุ "เป็นเงิน" ของคุณ — ถ้ามีเกิน การไล่ลาภ = ดูดพลัง</li>
          <li><b>วัยจร</b> — วงจร 10 ปีสลับธาตุทั้งชีวิต — กำหนดจังหวะรวย/ระวัง</li>
          <li><b>เทียร์ 1-4</b> — VIP/PRO/FREE/INFO — ระดับคุณภาพคำแนะนำรายหุ้น</li>
        </ul>
        <div className="callout good"><b>วิธีใช้เล่มนี้ (3 นาที)</b>อ่านภาค 1 รู้ตัวเอง → ภาค 2-4 เลือกของที่ตรง → ภาค 5 วางแผนช่วงวัย → ใช้ภาค 6 เป็นคู่มือรายเดือน</div>
      </section>

      {/* ═══════ 6 ภาค ═══════ */}
      {part("1", "มุมมองดวง", "กำลังดิถี ธาตุในดวง และความหมายต่อการเงินของคุณ", (
        <>
          <h3>ธาตุในดวง (โดนัท)</h3>
          <div className="two-col">
            <div>{donut(d.elementBalance.map((e) => ({ pct: e.pct, color: EL[e.element] ?? "#888" })))}</div>
            <div>
              {d.elementBalance.map((e) => (<div key={e.element} className="legend-row"><span className="swatch" style={{ background: EL[e.element] }} /><b>{e.element}</b> {e.pct}% ({e.count} ตัว)</div>))}
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>ธาตุ</th><th>บทบาท</th><th>ควรทำ</th></tr></thead>
            <tbody>
              {d.elementBalance.map((e) => {
                const role = e.element === d.strengthen.wealth ? `ธาตุลาภ${e.pct >= 30 ? " (เกิน — ดูดพลัง)" : ""}` : e.element === d.strengthen.element ? "ธาตุที่ต้องเสริม" : d.avoid.includes(e.element) ? "ธาตุพิฆาต" : "กลาง";
                const act = e.element === d.strengthen.element ? "ลงทุนธุรกิจธาตุนี้" : d.avoid.includes(e.element) ? "หลีกเลี่ยง" : e.pct >= 30 ? "อย่าเพิ่ม" : "ถือไว้";
                return (<tr key={e.element}><td><b style={{ color: EL[e.element] }}>{e.element}</b></td><td>{role}</td><td className={act.includes("หลีก") || act.includes("อย่า") ? "red" : "green"}>{act}</td></tr>);
              })}
            </tbody>
          </table>
          <div className="callout warn"><b>เทรดได้/ไม่ได้</b>{d.trading.label} — {d.trading.reason}</div>
        </>
      ), d.thPicks.picks.map((p) => ({ ticker: p.ticker, element: p.element, tier: p.stockTier })))}

      {part("2", "การจัดสรรเงิน", "70:10:20 และเครื่องมือของแต่ละกอง — ทำไมต้องสัดส่วนนี้", (
        <>
          <div className="two-col">
            <div>{donut([{ pct: d.trading.split.cold, color: "#1e6f3e" }, { pct: d.trading.split.fast, color: "#b8860b" }, { pct: d.trading.split.emergency, color: "#1565c0" }])}</div>
            <div>
              <div className="legend-row"><span className="swatch" style={{ background: "#1e6f3e" }} /><b>เงินเย็น (ยาว)</b> {d.trading.split.cold}%</div>
              <div className="legend-row"><span className="swatch" style={{ background: "#b8860b" }} /><b>เงินเร็ว (เทรด)</b> {d.trading.split.fast}%</div>
              <div className="legend-row"><span className="swatch" style={{ background: "#1565c0" }} /><b>เงินฉุกเฉิน</b> {d.trading.split.emergency}%</div>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>กอง</th><th>เครื่องมือที่แนะนำ</th></tr></thead>
            <tbody>
              <tr><td className="green"><b>เงินเย็น {d.trading.split.cold}%</b></td><td>{d.instruments.cold.join(" · ")}</td></tr>
              <tr><td className="gold"><b>เงินเร็ว {d.trading.split.fast}%</b></td><td>{d.instruments.fast.join(" · ")}</td></tr>
              <tr><td><b>ฉุกเฉิน {d.trading.split.emergency}%</b></td><td>{d.instruments.emergency.join(" · ")}</td></tr>
            </tbody>
          </table>
        </>
      ))}

      {part("3", "พอร์ตเด่น", "หุ้นที่ตรงดวงที่สุดจาก 5,958 บริษัท — พร้อมเหตุผลว่าทำไมแต่ละตัว", (
        <>
          <h3>TH30 — ตรงดวงที่สุด (เทียบ SET {d.thPicks.benchmark.changePct != null ? `${d.thPicks.benchmark.changePct}%` : "-"})</h3>
          <table className="tbl">
            <thead><tr><th>#</th><th>หุ้น</th><th>ธาตุ</th><th>เทียร์</th><th>คะแนน</th><th>เหตุผลหลัก</th></tr></thead>
            <tbody>
              {d.thPicks.picks.slice(0, 10).map((pk, i) => (
                <tr key={pk.ticker}><td>{i + 1}</td><td><b>{pk.ticker}</b></td><td style={{ color: EL[pk.element] }}>{pk.element}</td><td>{TIER_ICON[pk.stockTier]} {TIER_NAME[pk.stockTier]}</td><td><b>{pk.score}</b></td><td className="muted">{pk.reasons[0]}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>คะแนนพอร์ตเด่น</h3>
          {bars(d.thPicks.picks.slice(0, 10).map((pk) => ({ label: pk.ticker, value: pk.score, color: pk.stockTier === "gold" ? "#b8860b" : pk.stockTier === "silver" ? "#9aa5b1" : pk.stockTier === "bronze" ? "#b08d57" : "#c9c2b2" })))}
          <div className="callout info"><b>วิธีใช้</b>เริ่มจากเทียร์ 1-2 (ตรงดวง+พื้นฐานแข็ง) · เทียร์ 3 = ประกอบ · เทียร์ 4 = ยังไม่ควรแตะ · ซื้อเฉพาะวันมงคล + ผ่านเช็กลิสต์</div>
        </>
      ), d.thPicks.picks.map((p) => ({ ticker: p.ticker, element: p.element, tier: p.stockTier, extra: `คะแนน ${p.score}` })))}

      {part("4", "สินค้าแนะนำ", "สินทรัพย์/หมวดลงทุนที่ควรถือ — พร้อมเหตุผลว่าทำไม", (
        <>
          <table className="tbl">
            <thead><tr><th>หมวด</th><th>สินค้าเด่น (fit)</th></tr></thead>
            <tbody>
              {d.categories.map((cat) => {
                const items = cat.items.slice(0, 2).map((it) => `${it.ticker} (${FIT_LABEL[it.fit] ?? "กลาง"})`).join(" · ");
                return items ? <tr key={cat.label}><td><b>{cat.label}</b></td><td className="muted">{items}</td></tr> : null;
              })}
            </tbody>
          </table>
          <div className="callout info"><b>ความหมาย fit</b>ตรงดวง = ธาตุสินค้าอยู่ในธาตุที่ต้องเสริม (ลงทุนได้) · ดูดพลัง = ธาตุลาภเกิน — ไล่ลาภดึงพลัง · ขัดดวง = ธาตุพิฆาต — ห้ามแตะ</div>
        </>
      ), d.categories.flatMap((c) => c.items.slice(0, 1)).map((it) => ({ ticker: it.ticker, element: it.element, tier: it.stockTier, extra: FIT_LABEL[it.fit] })))}

      {part("5", "แผนที่ชีวิต", "วัยจร 0-80+ ปี — ลงทุนเมื่อไหร่ สะสมเมื่อไหร่ ต้องระวังเมื่อไหร่", (
        <>
          <div className="life-legend">{Object.entries(VMETA).map(([k, m]) => <span key={k}><i style={{ background: m.color }} />{m.label}</span>)}</div>
          <div className="life-map">{d.timeline.map((t) => { const m = VMETA[t.verdict] ?? VMETA.accumulate; return (<div key={t.ageRange} className="life-row" style={{ background: m.tint, borderLeft: `6px solid ${m.color}` }}><b>{t.ageRange} ปี</b><em style={{ color: m.color }}>{m.label}</em><span>{t.advice}</span></div>); })}</div>
          {d.timeline.filter((t) => t.verdict === "invest").length > 0 && (<div className="gold-box">⭐ ช่วงทองของคุณ: {d.timeline.filter((t) => t.verdict === "invest").map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ</div>)}
        </>
      ))}

      {part("6", "ฉบับเดือนนี้", "ธาตุเดือน ปฏิทินมงคล และแผนปฏิบัติรายเดือน (ของสด VIP)", (
        <>
          <div className={`callout ${d.monthAdvice.fit === "good" ? "good" : d.monthAdvice.fit === "avoid" ? "warn" : "info"}`}>
            <b>ธาตุเดือน: {d.monthAdvice.element ?? "-"} ({d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"})</b>{d.monthAdvice.text}
          </div>
          <h3>วันมงคล ({d.auspiciousDays.month.goodDayCount} วัน)</h3>
          <div className="day-grid green">{d.auspiciousDays.month.goodDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <h3>วันระวัง ({d.auspiciousDays.month.avoidDayCount} วัน)</h3>
          <div className="day-grid red">{d.auspiciousDays.month.avoidDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <div className="callout warn"><b>กฎเหล็ก 5 ข้อ</b>1) ซื้อเฉพาะวันมงคล · 2) ไม่เกิน 5% ต่อตัว · 3) เช็กลิสต์ก่อน · 4) เงินฉุกเฉินห้ามแตะ · 5) ธาตุเดือนขัด = ลดน้ำหนัก</div>
        </>
      ), d.thPicks.picks.slice(0, 3).map((p) => ({ ticker: p.ticker, element: p.element, tier: p.stockTier })))}

      {/* ═══ ภาคผนวก ═══ */}
      {maxSection >= 3 && (
        <section className="page">
          <h2 className="chap-head"><span>ภาคผนวก</span> เช็กลิสต์ก่อนลงทุน (30 ข้อ)</h2>
          <p className="lede">ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 24/30 ขึ้นไปถึงเริ่ม</p>
          {[
            `หุ้นธาตุ = ${d.strengthen.element} หรือธาตุที่ควรทำ (ไม่ใช่ ${d.avoid.join("/")})`, "fit ไม่ใช่ 'ขัดดวง'", "fit ไม่ใช่ 'ดูดพลัง' ถ้าดิถีอ่อน", "เทียร์ไม่ใช่ INFO", "วัยจรปัจจุบันไม่ใช่เลี่ยง/ห้ามเสี่ยง", "สัดส่วนเงินคงเดิม", "ซื้อเฉพาะวันมงคล", "ไม่เกิน 5% ต่อตัว", "มีเหตุผล 1 บรรทัด", "หุ้นใหญ่/สภาพคล่องดี", "DCA ถ้าวัยจรสะสม", "ไม่ใช้เงินกู้/มาร์จิ้น", "ตั้งจุดตัดขาดทุน -15%", "ธาตุเดือนไม่ขัด", "ธาตุหุ้นชัดเจน", "ROE ≥ 15% หรือ Buffett ผ่าน", "PE ไม่สูงสุดเป็นประวัติการณ์", "เงินเย็นเดือนนี้พอ", "ถือได้ 1 ปีขึ้นไป", "เงินฉุกเฉิน 6 เดือนมีแล้ว", "เช็กข่าวลบ 1 สัปดาห์", "ไม่ซื้อตามกระแสโซเชียล", "พอร์ตไม่ซ้ำธาตุเดียวเกิน 40%", "วันนี้ไม่ใช่วันระวัง", "สินทรัพย์ตรงกองที่ตั้งไว้", "IPO: ธาตุชัด + รอ 1 สัปดาห์", "ไม่ใช้เงินที่ต้องใช้ใน 6 เดือน", "เข้าใจธุรกิจ 2 ประโยค", "ตั้งเป้าหมายขายล่วงหน้า", "ผ่าน 24/30",
          ].map((c) => (<div key={c} className="check-row"><span className="check" />{c}</div>))}
        </section>
      )}

      <style>{`
        @page { size: A4; margin: 0; }
        @page report { size: A4; margin: 13mm 14mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: 'Leelawadee UI', 'Segoe UI', Tahoma, sans-serif; background: #e9e6de; color: #2b2417; }
        .print-shell { max-width: 210mm; margin: 0 auto; background: #fff; }
        .no-print.toolbar { position: sticky; top: 0; z-index: 50; background: #14532d; color: #fff; padding: 10px 16px; display: flex; gap: 14px; align-items: center; }
        .no-print.toolbar button { background: #b8860b; color: #fff; border: 0; border-radius: 8px; padding: 8px 18px; font-size: 14px; cursor: pointer; font-weight: 700; }
        .no-print.toolbar span { font-size: 12px; color: #cfe3d4; }
        section.page { page: report; padding: 0; min-height: 240mm; }
        h2.chap-head { font-size: 20px; color: #14532d; border-bottom: 3px solid #b8860b; padding-bottom: 6px; margin: 0 0 12px; }
        h2.chap-head span { color: #b8860b; }
        h3 { color: #2b2417; font-size: 15px; margin: 16px 0 8px; }
        p.lede { color: #8a6d3b; font-size: 13px; line-height: 1.6; }
        .muted { color: #777; font-size: 11.5px; }
        .part-banner { background: linear-gradient(135deg, #0f2e1c, #14532d 60%, #1d2130); color: #fff; border-radius: 14px; padding: 20px 24px; margin-bottom: 16px; border-bottom: 4px solid #b8860b; }
        .part-banner span { border: 1.5px solid #b8860b; color: #b8860b; border-radius: 30px; padding: 2px 14px; font-size: 12px; font-weight: 700; }
        .part-banner h1 { color: #fff; font-size: 26px; margin: 10px 0 4px; }
        .part-banner p { color: #cfe3d4; font-size: 13px; margin: 0; }
        .intro { font-size: 14px; color: #8a6d3b; font-style: italic; line-height: 1.7; margin: 0 0 10px; }
        .prose { font-size: 12.5px; line-height: 1.9; color: #333; text-align: justify; margin: 0 0 14px; white-space: pre-wrap; }
        .evidence { margin: 12px 0; }
        .picks { margin-top: 14px; }
        .pick-card { border: 1px solid #e0d9c8; border-radius: 10px; padding: 10px 14px; margin: 8px 0; background: #fcfbf7; }
        .pick-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .pick-head b { font-size: 14px; color: #14532d; }
        .chip { border-radius: 20px; padding: 2px 10px; font-size: 10.5px; color: #fff; font-weight: 700; }
        .gold-chip { background: #b8860b; }
        .pick-card p { font-size: 12px; line-height: 1.75; color: #444; margin: 0; }
        .two-col { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin: 10px 0 4px; }
        .donut { border-radius: 50%; position: relative; }
        .donut-hole { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 50%; }
        .legend-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; }
        .swatch { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
        table.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
        table.tbl th { background: #eef2ec; color: #14532d; text-align: left; padding: 6px 8px; font-size: 11.5px; }
        table.tbl td { padding: 5px 8px; border-bottom: 1px solid #e0d9c8; }
        table.tbl td.muted { color: #555; font-size: 11.5px; }
        .red { color: #9b2c2c; } .green { color: #1e6f3e; } .gold { color: #b8860b; }
        .callout { border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; line-height: 1.6; border-left: 4px solid; }
        .callout b { display: block; margin-bottom: 2px; font-size: 13px; }
        .callout.good { background: #e8f3ea; border-color: #1e6f3e; }
        .callout.warn { background: #f9ecec; border-color: #9b2c2c; }
        .callout.info { background: #fdf6e3; border-color: #b8860b; }
        .bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin: 10px 0; padding-bottom: 22px; position: relative; border-bottom: 1px solid #e0d9c8; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
        .bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; }
        .bar-col span { position: absolute; bottom: -18px; font-size: 9px; color: #666; }
        .bar-col em { position: absolute; top: -16px; font-size: 9px; font-style: normal; color: #333; }
        .life-legend { display: flex; gap: 16px; font-size: 11.5px; margin: 6px 0 10px; }
        .life-legend i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; margin-right: 4px; }
        .life-row { display: grid; grid-template-columns: 90px 110px 1fr; gap: 8px; padding: 6px 10px; margin: 3px 0; border-radius: 6px; font-size: 11.5px; align-items: center; }
        .life-row em { font-style: normal; font-weight: 700; }
        .life-row span { color: #555; }
        .gold-box { background: #fdf6e3; border: 1.5px solid #b8860b; border-radius: 10px; padding: 10px 14px; margin: 10px 0; color: #b8860b; font-weight: 700; font-size: 13px; }
        .day-grid { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 12px; }
        .day-grid span { border-radius: 6px; padding: 4px 9px; font-size: 11.5px; border: 1px solid; }
        .day-grid.green span { background: #e8f3ea; border-color: #1e6f3e; color: #1e6f3e; }
        .day-grid.red span { background: #f9ecec; border-color: #9b2c2c; color: #9b2c2c; }
        .toc-row { display: flex; gap: 14px; padding: 7px 4px; border-bottom: 1px dashed #e0d9c8; font-size: 13px; }
        .toc-row b { color: #b8860b; width: 70px; }
        .gloss-mini { margin: 6px 0; padding-left: 18px; font-size: 12.5px; line-height: 1.7; }
        .check-row { display: flex; gap: 10px; align-items: center; padding: 5px 0; font-size: 12.5px; border-bottom: 1px dotted #e0d9c8; }
        .check { width: 14px; height: 14px; border: 1.5px solid #1e6f3e; border-radius: 4px; flex-shrink: 0; }
        .summary-box { border: 2px solid #b8860b; border-radius: 14px; background: #fdf6e3; padding: 14px 18px; margin-top: 14px; }
        .summary-box b { color: #14532d; font-size: 13.5px; display: block; margin-bottom: 6px; }
        .summary-box p { font-size: 12.5px; line-height: 1.8; color: #444; margin: 0; }
        .locked { background: #e9e5da; border-radius: 10px; padding: 22px; text-align: center; margin: 20px 0; }
        .locked b { color: #9a9388; font-size: 15px; }
        .locked div { color: #b8860b; font-size: 12.5px; margin-top: 6px; }
        .cover { page: report; position: relative; height: 272mm; overflow: hidden; background: #fff; }
        .cover-top { background: linear-gradient(135deg, #0f2e1c, #14532d 60%, #1d2130); color: #fff; padding: 26mm 16mm 14mm; border-bottom: 5px solid #b8860b; }
        .cover-top h1 { margin: 8px 0 6px; font-size: 34px; color: #fff; }
        .cover-top p { margin: 0; color: #cfe3d4; font-size: 14px; }
        .cover-top small { color: #9fb8a8; font-size: 11px; }
        .cover-ring { display: flex; justify-content: center; padding: 18mm 0 10mm; }
        .cover-persona { margin: 0 16mm; background: #fdf6e3; border: 1.5px solid #b8860b; border-radius: 14px; padding: 14px 18px; text-align: center; }
        .persona-emoji { font-size: 34px; }
        .persona-name { font-size: 22px; color: #14532d; font-weight: 700; }
        .persona-sub { font-size: 13px; color: #8a6d3b; }
        .cover-foot { position: absolute; bottom: 0; left: 0; right: 0; background: #0c2416; color: #9fb8a8; font-size: 9px; padding: 8mm 16mm; text-align: center; }
        @media print {
          .no-print { display: none !important; }
          section.page { break-after: page; }
          section.page:last-of-type { break-after: auto; }
          .cover { height: 257mm; }
        }
      `}</style>
    </div>
  );
}
