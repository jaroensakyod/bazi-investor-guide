"use client";

import { useEffect, useState } from "react";

/* ═══════════ ข้อมูล (จาก API — เหมือน PDF เป๊ะ) ═══════════ */
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
// สี/ทิศ/เครื่องราง ตามธาตุ (ตารางซินแส — deterministic)
const EL_BOOST: Record<string, { color: string; dir: string; item: string }> = {
  ไม้: { color: "เขียว/น้ำตาล", dir: "ตะวันออก", item: "ต้นไม้ ไม้มงคล หนังสือ" },
  ไฟ: { color: "แดง/ส้ม/ม่วง", dir: "ทิศใต้", item: "เทียน ตะเกียง ของร้อนแรง" },
  ดิน: { color: "เหลือง/ครีม/น้ำตาล", dir: "กลาง/ตะวันตกเฉียงใต้", item: "หิน แร่ เซรามิก กระถาง" },
  ทอง: { color: "ขาว/เงิน/ทอง", dir: "ตะวันตก", item: "เหรียญ กุญแจ โลหะ" },
  น้ำ: { color: "ดำ/น้ำเงินเข้ม", dir: "ทิศเหนือ", item: "น้ำพุ ตู้ปลา กระจก" },
};

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
  const boost = EL_BOOST[d.strengthen.element] ?? EL_BOOST.ไฟ;
  const donut = (segs: Array<{ pct: number; color: string }>, size = 170) => (
    <div className="donut-wrap"><div className="donut" style={{ width: size, height: size, background: `conic-gradient(${segs.filter((s) => s.pct > 0).map((s) => `${s.color} 0 ${s.pct}%`).join(", ")})` }}><div className="donut-hole" style={{ width: size * 0.62, height: size * 0.62 }} /></div></div>
  );
  const bars = (items: Array<{ label: string; value: number; color: string }>) => (
    <div className="bars">{items.map((it) => (<div key={it.label} className="bar-col"><div className="bar" style={{ height: `${Math.max(4, it.value * 7)}px`, background: it.color }} /><span>{it.label}</span><em>{it.value}</em></div>))}</div>
  );
  const phaseOf = (start: number, end: number) => d.timeline.filter((t) => {
    const a = parseInt(t.ageRange.split("–")[0] || t.ageRange.split("-")[0] || "0", 10);
    return a >= start && a < end;
  });
  const verdictLine = (verdict: string) => {
    const m = VMETA[verdict] ?? VMETA.accumulate;
    return <span style={{ color: m.color, fontWeight: 700 }}>{m.label}</span>;
  };
  const ch = (num: string, title: string, children: React.ReactNode, intro?: string) => (
    <section className="page">
      <h2 className="chap-head"><span>บทที่ {num}</span> {title}</h2>
      {intro && <p className="lede">{intro}</p>}
      {children}
    </section>
  );
  const partHead = (num: string, title: string, desc: string) => (
    <section className="page part-head">
      <div className="part-badge">ภาค {num}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </section>
  );
  const locked = (n: number, t: string) => (
    <section className="page"><div className="locked"><b>บทที่ {n}. {t}</b><div>🔒 เนื้อหาส่วนนี้ถูกจำกัด — [ ล็อกอยู่ — ปลดล็อกด้วยฉบับที่สูงขึ้น ]</div></div></section>
  );

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
          <p>6 ภาค · 25 บท — ดวง 60 กะจื่อ × หุ้น/สินทรัพย์จริง × แผนที่ชีวิตทั้งชีวิต</p>
          <small>ฉบับ {maxSection >= 6 ? "VIP ฉบับเต็ม (25 บท)" : maxSection >= 4 ? "PRO (20 บท)" : maxSection >= 2 ? "ฉบับสรุป (10 บท)" : "ตัวอย่าง"} · {d.generatedAt}</small>
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
        <h2 className="chap-head">สารบัญ (6 ภาค · 25 บท)</h2>
        {[
          ["ภาค 1", "ดีเอ็นเอการเงิน — ธาตุลาภ/กำลังดิถี/คลังทรัพย์/จิตวิทยา/การ์ดตัวตน (บท 1-5)"],
          ["ภาค 2", "ลงทุนอะไร — เซกเตอร์/สินทรัพย์/ตลาด/สิ่งต้องห้าม/เช็กลิสต์ (บท 6-10)"],
          ["ภาค 3", "ลงทุนยังไง — สไตล์/เงินเร็วเย็น/พอร์ตธาตุ/DCA/ฟอเร็กซ์-คริปโต (บท 11-15)"],
          ["ภาค 4", "ลงทุนเมื่อไหร่ — วัยจร 4 ช่วง + แผนที่ชีวิต (บท 16-20)"],
          ["ภาค 5", "ป้องกัน — ผั่วไฉ่โข่ว/คลังแตก/กฎเหล็ก (บท 21-23)"],
          ["ภาค 6", "เสริมดวง — สี/ทิศ/เครื่องราง + เสริมตามวัยจร (บท 24-25)"],
          ["บท 26", "ฉบับเดือนนี้ (ของสด VIP) — ธาตุเดือน/ปฏิทินมงคล/แผนเดือน"],
        ].map(([n, t]) => (<div key={n} className="toc-row"><b>{n}</b><span>{t}</span></div>))}
        <h2 className="chap-head">บทนำ — วิธีอ่านหนังสือเล่มนี้</h2>
        <p className="lede">หนังสือ 25 บทนี้สร้างจากข้อมูลจริงของคุณเท่านั้น: ดวง 60 กะจื่อ (deterministic) × ข้อมูลตลาดจริง 5,958 หุ้น 27 ตลาด × ตารางธาตุซินแส</p>
        <ul className="gloss-mini">
          <li><b>ธาตุ</b> — พลัง 5 ชนิด (ไม้/ไฟ/ดิน/ทอง/น้ำ) — หุ้น/ธุรกิจ/สินทรัพย์มีธาตุของตัวเอง</li>
          <li><b>กำลังดิถี</b> — อ่อน = เสริม อย่าไล่ลาภ · แข็ง = ถ่ายเท กล้าลงทุน</li>
          <li><b>ธาตุลาภ</b> — ธาตุ "เป็นเงิน" ของคุณ — ถ้ามีเกิน การไล่ลาภ = ดูดพลัง</li>
          <li><b>วัยจร</b> — วงจร 10 ปีสลับธาตุทั้งชีวิต — กำหนดจังหวะรวย/ระวัง</li>
          <li><b>เทียร์ 1-4</b> — VIP/PRO/FREE/INFO — ระดับคุณภาพคำแนะนำรายหุ้น</li>
        </ul>
        <div className="callout good"><b>วิธีใช้เล่มนี้ (3 นาที)</b>ภาค 1 รู้ตัวเอง → ภาค 2 เลือกของที่ตรง → ภาค 3 วิธีลงทุน → ภาค 4 จังหวะชีวิต → ภาค 5 กันเจ๊ง → ภาค 6 เสริมดวง · ใช้บท 26 เป็นคู่มือรายเดือน</div>
      </section>

      {/* ═══════ ภาค 1: ดีเอ็นเอการเงิน (บท 1-5) — ฉบับสรุปขึ้นไป ═══════ */}
      {maxSection >= 1 && partHead("1", "ดีเอ็นเอการเงิน", "รู้จักตัวเองในเรื่องเงิน — ธาตุอะไรคือเงินของคุณ กำลังเท่าไหร่ เก็บอะไรแล้วอยู่")}
      {maxSection >= 1 && ch("1", "ธาตุลาภ — เงินของคุณมาจากธาตุอะไร", <>
        <p className="lede">ธาตุที่ "เป็นเงิน" ของดวงคุณ — ธุรกิจ/หุ้นธาตุนี้ให้ผลตอบแทนดีที่สุดกับคุณ</p>
        <div className="gold-box">💧 ธาตุลาภของคุณ = {d.strengthen.wealth} (ในดวงมี {d.elementBalance.find((e) => e.element === d.strengthen.wealth)?.count ?? "?"} ตัว / {d.elementBalance.find((e) => e.element === d.strengthen.wealth)?.pct ?? "?"}%)</div>
        <p>{d.principle.excessElement === d.strengthen.wealth ? "⚠️ แต่ธาตุลาภของคุณมีเกิน — การไล่ลาภจะดูดพลัง (身弱财旺) ต้องเสริมธาตุที่ขาดก่อน" : "ธาตุลาภมีพอดี — ลงทุนธุรกิจธาตุนี้ได้ แต่ยังต้องดูกำลังดิถี (บท 2)"}</p>
        <div className="callout info"><b>ตัวอย่างธุรกิจธาตุ {d.strengthen.wealth}</b>{d.strengthen.businessHint}</div>
      </>)}
      {maxSection >= 1 && ch("2", "กำลังดิถี — ไล่ลาภได้เต็มที่ หรือต้องสะสม", <>
        <table className="tbl">
          <thead><tr><th>กำลัง</th><th>ผลต่อการลงทุน</th><th>แนวทาง</th></tr></thead>
          <tbody>
            <tr><td><b>{d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล"}</b></td><td>{d.principle.mode}</td><td className="green">เสริม {d.principle.supplementElement}</td></tr>
          </tbody>
        </table>
        <p>{d.principle.desc}</p>
        <div className="callout warn"><b>เทรดได้/ไม่ได้</b>{d.trading.label} — {d.trading.reason}</div>
      </>)}
      {maxSection >= 1 && ch("3", "คลังทรัพย์ — เก็บอะไรแล้วอยู่", <>
        <p className="lede">สินทรัพย์ที่ "ดวงอุ้ม" — เก็บแล้วไม่เหนื่อย ไม่อาจเพลีย</p>
        {(() => {
          const good = d.categories.flatMap((c) => c.items).filter((it) => it.fit === "good").slice(0, 6);
          return <table className="tbl"><thead><tr><th>สินทรัพย์</th><th>ธาตุ</th><th>fit</th></tr></thead><tbody>{good.map((it) => (<tr key={it.ticker}><td><b>{it.ticker}</b> — {it.name}</td><td style={{ color: EL[it.element] }}>{it.element}</td><td className="green">{FIT_LABEL[it.fit]}</td></tr>))}</tbody></table>;
        })()}
        <div className="callout good"><b>หลักคลังทรัพย์</b>ถือสินทรัพย์ที่ fit=ตรงดวงเป็นแกน (เงินเย็น) · สินทรัพย์ fit=ดูดพลัง (เช่น ทองคำสำหรับดวงน้ำเกิน) เก็บได้แต่อย่าเก็ง</div>
      </>)}
      {maxSection >= 1 && ch("4", "จิตวิทยาเงิน — จุดอ่อนการตัดสินใจของคุณ", <>
        <div className="two-col">
          <div className="callout good" style={{ margin: 0 }}><b>จุดแข็ง</b>{d.persona.strengths ?? d.persona.style}</div>
          <div className="callout warn" style={{ margin: 0 }}><b>จุดที่ต้องระวัง</b>{d.persona.weaknesses ?? "ใจร้อนตามธาตุ ต้องมีกฎเหล็กรอซื้อ/ตัดขาดทุน"}</div>
        </div>
        <p style={{ marginTop: 10 }}>สไตล์การเงินของคุณ: <b>{d.persona.style}</b> — {d.trading.label === "เทรดไม่ได้" ? "เน้นสะสมระยะยาว อย่าเทรดรายวัน" : "สามารถเก็งกำไรได้บางส่วน"}</p>
      </>)}
      {maxSection >= 1 && ch("5", "การ์ดตัวตนนักลงทุน (สรุปภาค 1)", <>
        <div className="cover-persona" style={{ margin: 0 }}>
          <div className="persona-emoji">{d.persona.emoji}</div>
          <div className="persona-name">{d.persona.name} ({d.persona.bandLabel})</div>
          <div className="persona-sub">{d.persona.style} · เทรด: {d.trading.label}</div>
        </div>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th>หัวข้อ</th><th>คำตอบของคุณ</th></tr></thead>
          <tbody>
            <tr><td>ธาตุลาภ</td><td><b>{d.strengthen.wealth}</b></td></tr>
            <tr><td>ธาตุที่ต้องเสริม</td><td className="green"><b>{d.strengthen.element}</b></td></tr>
            <tr><td>ธาตุที่ต้องเลี่ยง</td><td className="red"><b>{d.avoid.join("/")}</b></td></tr>
            <tr><td>เทรดได้/ไม่ได้</td><td><b>{d.trading.label}</b></td></tr>
            <tr><td>สัดส่วนเงิน</td><td>เย็น {d.trading.split.cold}% · เร็ว {d.trading.split.fast}% · ฉุกเฉิน {d.trading.split.emergency}%</td></tr>
          </tbody>
        </table>
      </>)}

      {/* ═══════ ภาค 2: ลงทุนอะไร (บท 6-10) — ฉบับสรุปขึ้นไป ═══════ */}
      {maxSection >= 2 && partHead("2", "ลงทุนอะไร", "เอาเงินไปไว้ที่ไหน — เซกเตอร์/สินทรัพย์/ตลาด ที่ตรงธาตุ + สิ่งต้องห้าม")}
      {maxSection >= 2 && ch("6", "เซกเตอร์/หุ้นที่ตรงธาตุ", <>
        <p className="lede">หุ้นธาตุ {d.strengthen.element} (ต้องเสริม) — ตัวอย่างที่ตรงดวงที่สุดจาก 5,958 หุ้น</p>
        <table className="tbl"><thead><tr><th>#</th><th>หุ้น</th><th>ธาตุ</th><th>เทียร์</th><th>คะแนน</th></tr></thead><tbody>
          {d.thPicks.picks.slice(0, 8).map((pk, i) => (<tr key={pk.ticker}><td>{i + 1}</td><td><b>{pk.ticker}</b></td><td style={{ color: EL[pk.element] }}>{pk.element}</td><td>{TIER_ICON[pk.stockTier]} {TIER_NAME[pk.stockTier]}</td><td><b>{pk.score}</b></td></tr>))}
        </tbody></table>
        <div className="callout good"><b>วิธีใช้</b>เริ่มจากเทียร์ 1-2 (ตรงดวง+แข็ง) · ผ่านเช็กลิสต์บท 10 ก่อนซื้อ</div>
      </>)}
      {maxSection >= 2 && ch("7", "สินค้า/สินทรัพย์ (fit 4 ระดับ)", <>
        <table className="tbl"><thead><tr><th>หมวด</th><th>สินค้าเด่น</th></tr></thead><tbody>
          {d.categories.map((cat) => {
            const items = cat.items.slice(0, 2).map((it) => `${it.ticker} (${TIER_ICON[it.stockTier] ?? ""} ${FIT_LABEL[it.fit] ?? "กลาง"})`).join(" · ");
            return items ? <tr key={cat.label}><td><b>{cat.label}</b></td><td className="muted">{items}</td></tr> : null;
          })}
        </tbody></table>
        <div className="callout info"><b>ความหมาย fit</b>ตรงดวง = ลงทุนได้ · ดูดพลัง = เลี่ยง (ธาตุลาภเกิน) · ขัดดวง = ธาตุพิฆาต ห้ามแตะ</div>
      </>)}
      {maxSection >= 2 && ch("8", "ตลาด/ประเทศ (ธาตุตลาด × ดวงคุณ)", <>
        <p className="lede">ตลาดแต่ละประเทศมีธาตุของตัวเอง (ทิศจากไทย) — ตรง/ขัดดวงคุณ</p>
        <table className="tbl"><thead><tr><th>ตลาด</th><th>ธาตุ</th><th>กับดวงคุณ</th></tr></thead><tbody>
          <tr><td>🇹🇭 ไทย</td><td style={{ color: EL.น้ำ }}>น้ำ</td><td>{d.avoid.includes("น้ำ") ? "⚠️ ธาตุเลี่ยง — เลือกหุ้นรายตัวที่ตรงธาตุ (ไม่เหมารวมตลาด)" : "กลาง"}</td></tr>
          <tr><td>🇺🇸 สหรัฐฯ</td><td style={{ color: EL.ไม้ }}>ไม้</td><td>{d.avoid.includes("ไม้") ? "⚠️ ธาตุเลี่ยง — เน้นหุ้นรายตัวธาตุอื่น" : "กลาง"}</td></tr>
          <tr><td>🇮🇳 อินเดีย</td><td style={{ color: EL.ทอง }}>ทอง</td><td>{d.strengthen.element === "ทอง" ? "✅ ตรงธาตุที่ต้องเสริม" : "กลาง"}</td></tr>
          <tr><td>🇦🇺 ออสเตรเลีย</td><td style={{ color: EL.ไฟ }}>ไฟ</td><td>{d.strengthen.element === "ไฟ" ? "✅ ตรงธาตุที่ต้องเสริม" : "กลาง"}</td></tr>
        </tbody></table>
        <p className="muted">* ธาตุตลาด = ทิศจากไทย (ใช้เฉพาะภาพรวม) — ทุกหุ้น verdict รายตัวจากธาตุธุรกิจ ไม่เหมารวมทั้งตลาด</p>
      </>)}
      {maxSection >= 2 && ch("9", "สิ่งต้องห้าม (ธาตุพิฆาต)", <>
        <div className="gold-box">⛔ ธาตุพิฆาตของคุณ = {d.avoid.join(" / ")} — ห้ามแตะธุรกิจ/หุ้น/สินทรัพย์ธาตุนี้เด็ดขาด</div>
        <table className="tbl"><thead><tr><th>สิ่งที่ควรหลีกเลี่ยง</th><th>เหตุผล</th></tr></thead><tbody>
          {d.categories.flatMap((c) => c.items).filter((it) => it.fit === "avoid" || it.fit === "drain").slice(0, 5).map((it) => (<tr key={it.ticker}><td><b>{it.ticker}</b> — {it.name} ({FIT_LABEL[it.fit]})</td><td className="red">{it.fit === "avoid" ? "ธาตุพิฆาต — ทำลายดวง" : "ธาตุลาภเกิน — ดูดพลัง"}</td></tr>))}
        </tbody></table>
        <div className="callout warn"><b>กฎเหล็ก</b>ต่อให้หุ้นพื้นฐานดีแค่ไหน ถ้า fit=ขัดดวง = ไม่ซื้อ (กันขาดทุนใหญ่จากจังหวะที่ดวงไม่เอื้อ)</div>
      </>)}
      {maxSection >= 2 && ch("10", "เช็กลิสต์ 30 ข้อก่อนซื้อ", <>
        <p className="lede">ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 24/30 ขึ้นไปถึงเริ่ม</p>
        {[
          `หุ้นธาตุ = ${d.strengthen.element} หรือธาตุที่ควรทำ (ไม่ใช่ ${d.avoid.join("/")})`, "fit ไม่ใช่ 'ขัดดวง'", "fit ไม่ใช่ 'ดูดพลัง' ถ้าดิถีอ่อน", "เทียร์ไม่ใช่ INFO", "วัยจรปัจจุบันไม่ใช่เลี่ยง/ห้ามเสี่ยง", "สัดส่วนเงินเย็น/เร็ว/ฉุกเฉินคงเดิม", "ซื้อเฉพาะวันมงคล", "ไม่เกิน 5% ต่อตัว", "มีเหตุผล 1 บรรทัด", "หุ้นใหญ่/สภาพคล่องดี", "DCA ถ้าวัยจรสะสม", "ไม่ใช้เงินกู้/มาร์จิ้น", "ตั้งจุดตัดขาดทุน -15%", "ธาตุเดือนไม่ขัด", "ธาตุหุ้นชัดเจน", "ROE ≥ 15% หรือ Buffett ผ่าน", "PE ไม่สูงสุดเป็นประวัติการณ์", "เงินเย็นเดือนนี้พอ", "ถือได้ 1 ปีขึ้นไป", "เงินฉุกเฉิน 6 เดือนมีแล้ว", "เช็กข่าวลบ 1 สัปดาห์", "ไม่ซื้อตามกระแสโซเชียล", "พอร์ตไม่ซ้ำธาตุเดียวเกิน 40%", "วันนี้ไม่ใช่วันระวัง", "สินทรัพย์ตรงกองที่ตั้งไว้", "IPO: ธาตุชัด + รอ 1 สัปดาห์", "ไม่ใช้เงินที่ต้องใช้ใน 6 เดือน", "เข้าใจธุรกิจ 2 ประโยค", "ตั้งเป้าหมายขายล่วงหน้า", "ผ่าน 24/30",
        ].map((c) => (<div key={c} className="check-row"><span className="check" />{c}</div>))}
      </>)}
      {maxSection < 2 && locked(6, "ภาค 2 — ลงทุนอะไร")}

      {/* ═══════ ภาค 3: ลงทุนยังไง (บท 11-15) — PRO ขึ้นไป ═══════ */}
      {maxSection >= 3 && partHead("3", "ลงทุนยังไง", "วิธีลงทุนให้เข้ากับดวง — สไตล์/สัดส่วน/พอร์ตตามธาตุ/DCA/เก็งกำไร")}
      {maxSection >= 3 && ch("11", "สไตล์ตามเชี่ยงแซ (5 ปีนี้)", <>
        <div className="gold-box">สไตล์ของคุณ: {d.persona.style}</div>
        <p>เชี่ยงแซ 5 ปีปัจจุบันกำหนดจังหวะ — {d.trading.label === "เทรดไม่ได้" ? "เน้นถือยาว/สะสม ไม่เหมาะจับจังหวะสั้น" : "เล่นได้ทั้งสั้น-ยาว แต่ยังต้องเคารพวัยจร (บท 16-20)"}</p>
        <div className="callout info"><b>หลักการ</b>ดวงแข็ง → ถ่ายเทได้ (กล้าลงทุนหลายธีม) · ดวงอ่อน → เสริม (สะสมก้อนมั่นคง) — คุณเป็น{d.principle.band === "weak" ? "ดิถีอ่อน → ใช้หลักเสริม" : d.principle.band === "strong" ? "ดิถีแข็ง → ใช้หลักถ่ายเท" : "ดิถีสมดุล → ใช้ทั้งสอง"}</div>
      </>)}
      {maxSection >= 3 && ch("12", "เงินเร็ว-เย็น-ฉุกเฉิน (สัดส่วน)", <>
        <div className="two-col">
          <div>{donut([{ pct: d.trading.split.cold, color: "#1e6f3e" }, { pct: d.trading.split.fast, color: "#b8860b" }, { pct: d.trading.split.emergency, color: "#1565c0" }])}</div>
          <div>
            <div className="legend-row"><span className="swatch" style={{ background: "#1e6f3e" }} /><b>เงินเย็น</b> {d.trading.split.cold}% — {d.instruments.cold.join(" · ")}</div>
            <div className="legend-row"><span className="swatch" style={{ background: "#b8860b" }} /><b>เงินเร็ว</b> {d.trading.split.fast}% — {d.instruments.fast.join(" · ")}</div>
            <div className="legend-row"><span className="swatch" style={{ background: "#1565c0" }} /><b>ฉุกเฉิน</b> {d.trading.split.emergency}% — {d.instruments.emergency.join(" · ")}</div>
          </div>
        </div>
        <div className="callout warn"><b>กติกา</b>เงินเย็น = ห้ามแตะแม้ตลาดร่วง · เงินเร็ว = ขาดทุนได้แต่ห้ามเติม · ฉุกเฉิน = กันภัย 6 เดือน</div>
      </>)}
      {maxSection >= 3 && ch("13", "จัดพอร์ตตามธาตุ", <>
        <p className="lede">พอร์ต % ต่อธาตุ — สะท้อนสมดุลในดวงคุณ</p>
        {bars(d.elementBalance.map((e) => ({ label: e.element, value: e.pct, color: EL[e.element] ?? "#888" })))}
        <p>ดวงคุณมี {d.strengthen.element} {d.elementBalance.find((e) => e.element === d.strengthen.element)?.pct ?? 0}% → ควรเพิ่มน้ำหนักสินทรัพย์ธาตุ {d.strengthen.element} ในพอร์ตให้สอดคล้อง (ไม่เกิน 40% ต่อธาตุเดียว)</p>
      </>)}
      {maxSection >= 3 && ch("14", "DCA / สะสม (จังหวะทยอยซื้อ)", <>
        <p className="lede">วัยจรแบบ "สะสม" = ทยอยซื้อ (DCA) ดีกว่าซื้อทีเดียว</p>
        {phaseOf(0, 100).filter((t) => t.verdict === "accumulate").slice(0, 4).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA.accumulate.tint, borderLeft: `6px solid ${VMETA.accumulate.color}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA.accumulate.color }}>สะสม/ถือ</em><span>{t.advice}</span></div>))}
        <div className="callout good"><b>วิธี DCA</b>แบ่งซื้อรายเดือน (เช่น 12 งวด) เฉพาะวันมงคล · วัยจร "ลงทุนเต็มที่" = ซื้อก้อนได้</div>
      </>)}
      {maxSection >= 3 && ch("15", "forex / คริปโต (เก็งกำไรขั้นสูง)", <>
        <div className="callout warn"><b>คำเตือน</b>{d.trading.label === "เทรดไม่ได้" ? "ดวงคุณเทรดไม่ได้ — เก็งกำไรสูงสุด (ฟอเร็กซ์/คริปโต/ฟิวเจอร์ส) = เสี่ยงสูงสุด ควรหลีกเลี่ยง หรือจำกัดไม่เกิน 5% ของเงินเร็ว (0.5% ของพอร์ต)" : "เก็งกำไรได้เฉพาะสัดส่วนเงินเร็ว — ไม่เกิน 10% ของเงินเร็ว"}</div>
        <p className="muted">เครื่องมือเก็งกำไรในข้อมูลคุณ: {d.instruments.fast.join(" · ")} — ใช้เฉพาะเงินเร็ว + วันมงคล + มีจุดตัดขาดทุน</p>
      </>)}

      {/* ═══════ ภาค 4: ลงทุนเมื่อไหร่ (บท 16-20) — PRO ขึ้นไป ═══════ */}
      {maxSection >= 3 && partHead("4", "ลงทุนเมื่อไหร่", "จังหวะชีวิตทั้ง 80 ปี — ช่วงไหนรวย ช่วงไหนต้องระวัง")}
      {maxSection >= 3 && ch("16", "วัยจร 0-20 (ปฐมวัย — สร้างนิสัย)", <>
        {phaseOf(0, 20).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <div className="callout info"><b>ความหมาย</b>ช่วงสร้างนิสัยการเงิน — เรียน/ออมแรกเริ่ม ยังไม่ต้องเสี่ยงก้อนใหญ่</div>
      </>)}
      {maxSection >= 3 && ch("17", "วัยจร 20-40 (สร้างตัว — สะสมก้อน)", <>
        {phaseOf(20, 40).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <div className="callout good"><b>ความหมาย</b>ช่วงสะสมฐาน — เงินเย็น + DCA ต่อเนื่อง อย่าหักโหมเสี่ยง</div>
      </>)}
      {maxSection >= 3 && ch("18", "วัยจร 40-60 (จังหวะทอง)", <>
        {phaseOf(40, 60).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <div className="gold-box">⭐ ช่วงนี้คือจังหวะสำคัญที่สุดของชีวิต — ถ้าเป็น "ลงทุนเต็มที่" = ริเริ่ม ลงทุนก้อน อย่าพลาด · ถ้าเป็น "สะสม" = DCA เข้มข้น</div>
      </>)}
      {maxSection >= 3 && ch("19", "วัยจร 60-80 (รักษาทรัพย์)", <>
        {phaseOf(60, 100).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <div className="callout warn"><b>ความหมาย</b>ช่วงรักษาทรัพย์ — เปลี่ยนเป็นเงินเย็น/มรดก · ปีที่ "ห้ามเสี่ยง" = งดก้อนใหญ่ เก็บเงินสด</div>
      </>)}
      {maxSection >= 3 && ch("20", "แผนที่ชีวิต (Life Map 0-80+ ดูจบในตาเดียว)", <>
        <div className="life-legend">{Object.entries(VMETA).map(([k, m]) => <span key={k}><i style={{ background: m.color }} />{m.label}</span>)}</div>
        <div className="life-map">{d.timeline.map((t) => { const m = VMETA[t.verdict] ?? VMETA.accumulate; return (<div key={t.ageRange} className="life-row" style={{ background: m.tint, borderLeft: `6px solid ${m.color}` }}><b>{t.ageRange} ปี</b><em style={{ color: m.color }}>{m.label}</em><span>{t.advice}</span></div>); })}</div>
        {d.timeline.filter((t) => t.verdict === "invest").length > 0 && (<div className="gold-box">⭐ ช่วงทองของคุณ: {d.timeline.filter((t) => t.verdict === "invest").map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ</div>)}
      </>)}
      {maxSection < 3 && locked(11, "ภาค 3-4 — ลงทุนยังไง + เมื่อไหร่")}

      {/* ═══════ ภาค 5: ป้องกัน (บท 21-23) — VIP ═══════ */}
      {maxSection >= 6 && partHead("5", "ป้องกัน", "กันเจ๊ง — จุดรั่วไหล ช่วงคลังแตก กฎเหล็กคุ้มครอง")}
      {maxSection >= 6 && ch("21", "ผั่วไฉ่โข่ว (จุดรั่วไหลของเงิน)", <>
        <p className="lede">วัน/ช่วงที่เงินรั่วไหลง่าย — งดธุรกรรมใหญ่</p>
        <div className="day-grid red">{d.auspiciousDays.month.avoidDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
        <div className="callout warn"><b>เดือนนี้มีวันระวัง {d.auspiciousDays.month.avoidDayCount} วัน</b>วันเหล่านี้ห้าม: ซื้อก้อนใหญ่/เซ็นสัญญา/โอนเงินเสี่ยง — เก็บเงินสด รอวันมงคล</div>
      </>)}
      {maxSection >= 6 && ch("22", "คลังแตก (ช่วงที่ต้องลดความเสี่ยง)", <>
        {d.timeline.filter((t) => t.verdict === "avoid" || t.verdict === "no-risk").map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <div className="callout warn"><b>กฎช่วงคลังแตก</b>ห้ามเสี่ยงเด็ดขาด · กันเงินสด/สำรอง 6 เดือน · ไม่กู้ ไม่มาร์จิ้น ไม่ตามกระแส</div>
      </>)}
      {maxSection >= 6 && ch("23", "กฎเหล็ก 5 ข้อ (คุ้มครองตัวเอง)", <>
        {["ซื้อเฉพาะวันมงคล", "ไม่เกิน 5% ของพอร์ตต่อตัวเดียว", "ผ่านเช็กลิสต์ 30 ข้อก่อนทุกการซื้อ", "เงินฉุกเฉินห้ามแตะเด็ดขาด", "ธาตุเดือนขัดดวง = ลดน้ำหนัก งดเสี่ยง"].map((g, i) => (<div key={g} className="check-row"><span className="check" />{`${i + 1}. ${g}`}</div>))}
        <div className="callout good"><b>กฎเหล่านี้กัน "เจ๊งครั้งใหญ่"</b>— ขาดทุนเล็กยอมได้ ขาดทุนที่ทำลายพอร์ต = ไม่มีในพจนานุกรมของคุณ</div>
      </>)}

      {/* ═══════ ภาค 6: เสริม (บท 24-25) — VIP ═══════ */}
      {maxSection >= 6 && partHead("6", "เสริมดวง", "ดวงดีขึ้นได้ — สี/ทิศ/เครื่องราง + เสริมตามวัยจร")}
      {maxSection >= 6 && ch("24", "สี / ทิศ / เครื่องราง (เสริมธาตุ)", <>
        <table className="tbl"><thead><tr><th>รายการ</th><th>คำแนะนำของคุณ</th></tr></thead><tbody>
          <tr><td><b>ธาตุที่ต้องเสริม</b></td><td className="green">{d.strengthen.element}</td></tr>
          <tr><td><b>สี</b></td><td>{boost.color}</td></tr>
          <tr><td><b>ทิศ</b></td><td>{boost.dir}</td></tr>
          <tr><td><b>เครื่องราง/ของเสริม</b></td><td>{boost.item}</td></tr>
        </tbody></table>
        <div className="callout info"><b>วิธีใช้</b>เสื้อผ้า/กระเป๋า/โต๊ะทำงานสีที่เสริม · วางของมงคลทิศที่แนะนำ · นัดประชุม/เซ็นสัญญาทิศดี</div>
      </>)}
      {maxSection >= 6 && ch("25", "เสริมตามวัยจร (ช่วงนี้ต้องเสริมอะไร)", <>
        {d.timeline.slice(0, 4).map((t) => (<div key={t.ageRange} className="life-row" style={{ background: VMETA[t.verdict]?.tint ?? "#eee", borderLeft: `6px solid ${VMETA[t.verdict]?.color ?? "#888"}` }}><b>{t.ageRange} ปี</b><em style={{ color: VMETA[t.verdict]?.color }}>{VMETA[t.verdict]?.label}</em><span>{t.advice}</span></div>))}
        <p className="muted">* วัยจรถัดไป = เปลี่ยนธาตุ — อ่านบท 16-20 วางแผนล่วงหน้า 5 ปี</p>
      </>)}

      {/* ═══════ บท 26: ฉบับเดือนนี้ (VIP ของสด) ═══════ */}
      {maxSection >= 6 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 26</span> ฉบับเดือนนี้ — ของสด VIP</h2>
          <p className="lede">อัปเดตทุกเดือนตามธาตุเดือน — ส่วนนี้คือ "ของสด" ที่ทำให้ VIP คุ้มค่ารายเดือน</p>
          <div className={`callout ${d.monthAdvice.fit === "good" ? "good" : d.monthAdvice.fit === "avoid" ? "warn" : "info"}`}>
            <b>ธาตุเดือน: {d.monthAdvice.element ?? "-"} ({d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"})</b>{d.monthAdvice.text}
          </div>
          <h3>ปฏิทินมงคลทั้งเดือน</h3>
          <p className="green"><b>วันมงคล {d.auspiciousDays.month.goodDayCount} วัน</b></p>
          <div className="day-grid green">{d.auspiciousDays.month.goodDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <p className="red"><b>วันระวัง {d.auspiciousDays.month.avoidDayCount} วัน</b></p>
          <div className="day-grid red">{d.auspiciousDays.month.avoidDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <div className="callout good"><b>สิ่งที่ต้องทำเดือนนี้</b>
            {d.monthAdvice.fit === "good" ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} หนุนดวง → เพิ่มน้ำหนักธาตุ ${d.strengthen.element} · ทำธุรกรรมใหญ่ในวันมงคล · ทยอย DCA`
              : d.monthAdvice.fit === "avoid" ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} ขัดดวง → ลดความเสี่ยง งดก้อนใหญ่ เก็บเงินสดในวันระวัง`
                : "เดือนนี้ธาตุกลาง → ทำตามแผนปกติ ทยอยสะสมในวันมงคล"}
          </div>
          <div className="callout warn"><b>กฎเหล็ก 5 ข้อ (ทุกเดือน)</b>1) ซื้อเฉพาะวันมงคล · 2) ไม่เกิน 5% ต่อตัว · 3) เช็กลิสต์ 30 ข้อ · 4) เงินฉุกเฉินห้ามแตะ · 5) ธาตุเดือนขัด = ลดน้ำหนัก</div>
        </section>
      ) : locked(26, "ฉบับเดือนนี้ (ของสด VIP)")}

      {/* ═══ สรุป LLM ═══ */}
      {maxSection >= 2 && d.narrative.summary && (
        <section className="page"><div className="summary-box"><h2>สรุป — ทำอะไร 3 อันดับแรก</h2><p>{d.narrative.summary}</p></div></section>
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
        .part-head { text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(160deg, #0f2e1c, #14532d 60%, #1d2130); color: #fff; border-radius: 14px; }
        .part-head .part-badge { border: 2px solid #b8860b; color: #b8860b; border-radius: 30px; padding: 4px 18px; font-size: 14px; font-weight: 700; }
        .part-head h1 { color: #fff; font-size: 30px; margin: 12px 0 6px; }
        .part-head p { color: #cfe3d4; font-size: 13.5px; }
        .two-col { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin: 10px 0 4px; }
        .donut { border-radius: 50%; position: relative; }
        .donut-hole { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 50%; }
        .legend-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; }
        .swatch { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
        table.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
        table.tbl th { background: #eef2ec; color: #14532d; text-align: left; padding: 6px 8px; font-size: 11.5px; }
        table.tbl td { padding: 5px 8px; border-bottom: 1px solid #e0d9c8; }
        table.tbl td.muted { color: #555; font-size: 11.5px; }
        .red { color: #9b2c2c; } .green { color: #1e6f3e; }
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
        .summary-box { border: 2px solid #b8860b; border-radius: 14px; background: #fdf6e3; padding: 18px; }
        .summary-box h2 { color: #14532d; margin: 0 0 8px; }
        .summary-box p { font-size: 13.5px; line-height: 1.8; color: #444; }
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
