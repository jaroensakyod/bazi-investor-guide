"use client";

import { useEffect, useState } from "react";

/* ═══════════ ข้อมูล (จาก API — เหมือน PDF เป๊ะ) ═══════════ */
type ReportData = {
  persona: { name: string; emoji: string; bandLabel: string; style: string };
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

/* ═══════════ หน้า: รายงานคุณภาพ (พิมพ์ PDF) ═══════════ */
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
  const locked = (n: number, t: string) => (
    <div className="locked">
      <b>{n}. {t}</b>
      <div>🔒 เนื้อหาส่วนนี้ถูกจำกัด (ตัวอย่างเบลอ) — [ ล็อกอยู่ — ปลดล็อกด้วยฉบับที่สูงขึ้น ]</div>
    </div>
  );
  const donut = (segs: Array<{ pct: number; color: string }>, size = 170) => (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${segs.filter((s) => s.pct > 0).map((s) => `${s.color} 0 ${s.pct}%`).join(", ")})`,
        }}
      >
        <div className="donut-hole" style={{ width: size * 0.62, height: size * 0.62 }} />
      </div>
    </div>
  );
  const bars = (items: Array<{ label: string; value: number; color: string }>) => (
    <div className="bars">
      {items.map((it) => (
        <div key={it.label} className="bar-col">
          <div className="bar" style={{ height: `${Math.max(4, it.value * 7)}px`, background: it.color }} title={`${it.label} ${it.value}`} />
          <span>{it.label}</span>
          <em>{it.value}</em>
        </div>
      ))}
    </div>
  );

  return (
    <div className="print-shell">
      {/* ── ปุ่ม (ไม่ปริ้น) ── */}
      <div className="no-print toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
        <span>เลือก "บันทึกเป็น PDF" ในกล่องพิมพ์ · A4 · ขอบกระดาษ: ตั้งค่าเริ่มต้น</span>
      </div>

      {/* ═══ ปก ═══ */}
      <section className="cover">
        <div className="cover-top">
          <div>☯ ดวงนักลงทุน · ฉบับสถาบัน</div>
          <h1>รายงานการลงทุนคู่ดวง</h1>
          <p>ดวง 60 กะจื่อ × หุ้น/สินทรัพย์จริง × แผนที่ชีวิตทั้งชีวิต</p>
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
        {[["บทที่ 1", "มุมมองดวง (Verdict) — กำลังดิถี + ธาตุในดวง"], ["บทที่ 2", "การจัดสรรเงินตามกำลังดวง (70/10/20)"], ["บทที่ 3", "พอร์ตเด่นประจำเดือน (เทียร์ 1-4)"], ["บทที่ 4", "สินค้าแนะนำตามดวง (11 หมวด)"], ["บทที่ 5", "แผนที่ชีวิต Life Map 0-80+ ปี"], ["บทที่ 6", "วันมงคล / วันระวัง (เดือนนี้)"], ["ภาคผนวก ก", "เช็กลิสต์ก่อนลงทุน (16 ข้อ)"], ["ภาคผนวก ข", "อภิธานศัพท์"]].map(([n, t]) => (
          <div key={n} className="toc-row"><b>{n}</b><span>{t}</span></div>
        ))}
        <h2 className="chap-head">บทนำ — วิธีอ่านหนังสือเล่มนี้</h2>
        <p className="lede">หนังสือเล่มนี้สร้างจากข้อมูลจริงของคุณเท่านั้น: ดวง 60 กะจื่อ (deterministic) × ข้อมูลตลาดจริง 5,958 หุ้น 27 ตลาด × ตารางธาตุซินแส</p>
        <h3>คำศัพท์ที่ต้องรู้ก่อนอ่าน</h3>
        <ul className="gloss-mini">
          <li><b>ธาตุ</b> — พลัง 5 ชนิด (ไม้/ไฟ/ดิน/ทอง/น้ำ) ในดวงและในธุรกิจ — หุ้นแต่ละตัวมีธาตุของตัวเอง</li>
          <li><b>กำลังดิถี</b> — อ่อน = ต้องเสริม อย่าไล่ลาภ / แข็ง = ถ่ายเทได้ กล้าลงทุน</li>
          <li><b>ธาตุลาภ</b> — ธาตุที่ "เป็นเงิน" ของคุณ — แต่ถ้ามีเกิน การไล่ลาภ = ดูดพลัง</li>
          <li><b>วัยจร</b> — วงจร 10 ปีที่สลับธาตุทั้งชีวิต — กำหนดจังหวะรวย/ระวัง</li>
          <li><b>เทียร์ 1-4</b> — VIP/PRO/FREE/INFO — ระดับคุณภาพคำแนะนำรายหุ้น</li>
        </ul>
        <div className="callout good"><b>วิธีใช้เล่มนี้ (3 นาที)</b>อ่านบท 1 รู้กำลังตัวเอง → บท 3 เลือกหุ้นเทียร์ 1-2 → บท 5 วางแผนช่วงวัย → เช็กลิสต์ภาคผนวก ก ก่อนซื้อทุกครั้ง</div>
      </section>

      {/* ═══ บท 1 ═══ */}
      {maxSection >= 1 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 1</span> มุมมองดวง (Verdict)</h2>
          <p className="lede">{d.narrative["1"] ?? "ส่วนนี้สรุปกำลังดวงของคุณ — หลักตั้งต้นของทุกคำแนะนำในเล่มนี้"}</p>
          <div className="two-col">
            <div>{donut(d.elementBalance.map((e) => ({ pct: e.pct, color: EL[e.element] ?? "#888" })))}</div>
            <div>
              {d.elementBalance.map((e) => (
                <div key={e.element} className="legend-row">
                  <span className="swatch" style={{ background: EL[e.element] }} />
                  <b>{e.element}</b> {e.pct}%
                </div>
              ))}
            </div>
          </div>
          <h3>ตารางธาตุในดวง — ดี/ไม่ดี ยังไง</h3>
          <table className="tbl">
            <thead><tr><th>ธาตุ</th><th>จำนวน</th><th>บทบาท</th><th>ควรทำ</th></tr></thead>
            <tbody>
              {d.elementBalance.map((e) => {
                const role = e.element === d.strengthen.wealth ? `ธาตุลาภ${e.pct >= 30 ? " (เกิน — ดูดพลัง)" : ""}` : e.element === d.strengthen.element ? "ธาตุที่ต้องเสริม" : d.avoid.includes(e.element) ? "ธาตุพิฆาต" : "กลาง";
                const act = e.element === d.strengthen.element ? "ลงทุนธุรกิจธาตุนี้" : d.avoid.includes(e.element) ? "หลีกเลี่ยง" : e.pct >= 30 ? "อย่าเพิ่ม" : "ถือไว้";
                return (
                  <tr key={e.element}>
                    <td><b style={{ color: EL[e.element] }}>{e.element}</b></td>
                    <td>{e.count ?? "?"} ตัว ({e.pct}%)</td>
                    <td>{role}</td>
                    <td className={act.includes("หลีก") || act.includes("อย่า") ? "red" : "green"}>{act}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {d.principle.excessElement && <div className="callout warn"><b>ขอเตือน</b>ธาตุ {d.principle.excessElement} มีเกิน ({d.principle.excessCount} ตัว) — {d.principle.excessNote ?? "อย่าเพิ่ม ไม่งั้นเสียสมดุล"}</div>}
          <div className="callout info"><b>ข้อควรรู้</b>ธาตุลาภของคุณคือ {d.strengthen.wealth} — เงินมาจากธุรกิจธาตุนี้ แต่ใช้หลัก "เสริมก่อน ไล่ลาภทีหลัง"</div>
        </section>
      ) : locked(1, "มุมมองดวง (Verdict)")}

      {/* ═══ บท 2 ═══ */}
      {maxSection >= 2 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 2</span> การจัดสรรเงินตามกำลังดวง</h2>
          <p className="lede">{d.narrative["2"] ?? "กำลังดวงกำหนดว่า 'ไล่กำไรได้แค่ไหน' — ดิถีอ่อนต้องกันเงินเย็นไว้มาก"}</p>
          <div className="two-col">
            <div>{donut([{ pct: d.trading.split.cold, color: "#1e6f3e" }, { pct: d.trading.split.fast, color: "#b8860b" }, { pct: d.trading.split.emergency, color: "#1565c0" }])}</div>
            <div>
              <div className="legend-row"><span className="swatch" style={{ background: "#1e6f3e" }} /><b>เงินเย็น (ยาว)</b> {d.trading.split.cold}%</div>
              <div className="legend-row"><span className="swatch" style={{ background: "#b8860b" }} /><b>เงินเร็ว (เทรด)</b> {d.trading.split.fast}%</div>
              <div className="legend-row"><span className="swatch" style={{ background: "#1565c0" }} /><b>เงินฉุกเฉิน</b> {d.trading.split.emergency}%</div>
            </div>
          </div>
          <h3>เครื่องมือของแต่ละกอง</h3>
          <table className="tbl">
            <thead><tr><th>กอง</th><th>เครื่องมือที่แนะนำ</th></tr></thead>
            <tbody>
              <tr><td className="green"><b>เงินเย็น {d.trading.split.cold}%</b></td><td>{d.instruments.cold.join(" · ")}</td></tr>
              <tr><td className="gold"><b>เงินเร็ว {d.trading.split.fast}%</b></td><td>{d.instruments.fast.join(" · ")}</td></tr>
              <tr><td><b>ฉุกเฉิน {d.trading.split.emergency}%</b></td><td>{d.instruments.emergency.join(" · ")}</td></tr>
            </tbody>
          </table>
          <div className="callout warn"><b>ข้อควรระวัง</b>เงินเย็น = ห้ามแตะแม้ตลาดร่วง (กองรอจังหวะทอง) · เงินเร็ว = ขาดทุนได้แต่ห้ามเกินสัดส่วน · ฉุกเฉิน = กันภัย 6 เดือน</div>
          <div className="callout info"><b>ข้อควรรู้</b>การเทรด: {d.trading.label} — {d.trading.reason}</div>
        </section>
      ) : locked(2, "การจัดสรรเงินตามกำลังดวง")}

      {/* ═══ บท 3 ═══ */}
      {maxSection >= 3 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 3</span> พอร์ตเด่นประจำเดือน (เทียร์ 1-4)</h2>
          <p className="lede">{d.narrative["3"] ?? "วิธีอ่านเทียร์: 1=VIP ตรงดวง+แข็ง · 2=PRO · 3=FREE · 4=INFO แค่ข้อมูล"}</p>
          <h3>TH30 — 30 หุ้นไทยที่ตรงดวงที่สุด (เทียบ SET {d.thPicks.benchmark.changePct != null ? `${d.thPicks.benchmark.changePct}%` : "-"})</h3>
          <table className="tbl">
            <thead><tr><th>#</th><th>หุ้น</th><th>ธาตุ</th><th>เทียร์</th><th>คะแนน</th><th>เหตุผลหลัก</th></tr></thead>
            <tbody>
              {d.thPicks.picks.map((pk, i) => (
                <tr key={pk.ticker}>
                  <td>{i + 1}</td>
                  <td><b>{pk.ticker}</b></td>
                  <td style={{ color: EL[pk.element] }}>{pk.element}</td>
                  <td>{TIER_ICON[pk.stockTier]} {TIER_NAME[pk.stockTier]}</td>
                  <td><b>{pk.score}</b></td>
                  <td className="muted">{pk.reasons[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>คะแนนพอร์ตเด่น (กราฟ)</h3>
          {bars(d.thPicks.picks.slice(0, 10).map((pk) => ({ label: pk.ticker, value: pk.score, color: pk.stockTier === "gold" ? "#b8860b" : pk.stockTier === "silver" ? "#9aa5b1" : pk.stockTier === "bronze" ? "#b08d57" : "#c9c2b2" })))}
          <div className="callout good"><b>วิธีใช้พอร์ตนี้</b>เริ่มจากเทียร์ 1-2 ก่อน (ตรงดวง+พื้นฐานแข็ง) · เทียร์ 3 = ฟรี ประกอบ · เทียร์ 4 = ยังไม่ควรแตะ · ซื้อเฉพาะวันมงคล + ผ่านเช็กลิสต์</div>
        </section>
      ) : locked(3, "พอร์ตเด่นประจำเดือน (เทียร์)")}

      {/* ═══ บท 4 ═══ */}
      {maxSection >= 4 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 4</span> สินค้าแนะนำตามดวง (11 หมวด)</h2>
          <p className="lede">{d.narrative["4"] ?? "ตรงดวง = ลงทุนได้ · ดูดพลัง = เลี่ยง · ขัดดวง = อย่าแตะ"}</p>
          <table className="tbl">
            <thead><tr><th>หมวด</th><th>สินค้าเด่น (เทียร์/fit)</th></tr></thead>
            <tbody>
              {d.categories.map((cat) => {
                const items = cat.items.slice(0, 2).map((it) => `${it.ticker} (${TIER_ICON[it.stockTier] ?? ""} ${FIT_LABEL[it.fit] ?? "กลาง"})`).join(" · ");
                return items ? <tr key={cat.label}><td><b>{cat.label}</b></td><td className="muted">{items}</td></tr> : null;
              })}
            </tbody>
          </table>
          <div className="callout info"><b>ความหมายของ fit</b>ตรงดวง = ธาตุสินค้าอยู่ในธาตุที่ต้องเสริม (ลงทุนได้) · ดูดพลัง = ธาตุลาภเกิน — การไล่ลาภดึงพลัง (ดิถีอ่อนเสี่ยงสุด) · ขัดดวง = ธาตุพิฆาต — ห้ามแตะ</div>
          <div className="callout warn"><b>ข้อควรระวัง</b>fit='ตรงดวง' แต่เทียร์ 4 = แค่ข้อมูล — ต้องเทียร์ 1-2 ถึงลงทุนจริง</div>
        </section>
      ) : locked(4, "สินค้าแนะนำตามดวง (11 หมวด)")}

      {/* ═══ บท 5 ═══ */}
      {maxSection >= 5 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 5</span> แผนที่ชีวิต (Life Map) 0-80+ ปี</h2>
          <p className="lede">{d.narrative["5"] ?? "แต่ละแถบ = วัยจร 5 ปี — วางแผนการเงินทั้งชีวิตจากแถบนี้"}</p>
          <div className="life-legend">
            {Object.entries(VMETA).map(([k, m]) => <span key={k}><i style={{ background: m.color }} />{m.label}</span>)}
          </div>
          <div className="life-map">
            {d.timeline.map((t) => {
              const m = VMETA[t.verdict] ?? VMETA.accumulate;
              return (
                <div key={t.ageRange} className="life-row" style={{ background: m.tint, borderLeft: `6px solid ${m.color}` }}>
                  <b>{t.ageRange} ปี</b><em style={{ color: m.color }}>{m.label}</em><span>{t.advice}</span>
                </div>
              );
            })}
          </div>
          {d.timeline.filter((t) => t.verdict === "invest").length > 0 && (
            <div className="gold-box">⭐ ช่วงทองของคุณ: {d.timeline.filter((t) => t.verdict === "invest").map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ</div>
          )}
          <div className="callout good"><b>วิธีใช้ Life Map</b>ดูแถบสีอายุปัจจุบัน → ทำตามคำแนะนำช่วงนั้น · เตรียมเงินเย็นรอช่วงทอง · ช่วงแดง = ห้ามเสี่ยงเด็ดขาด</div>
        </section>
      ) : locked(5, "แผนที่ชีวิต (Life Map)")}

      {/* ═══ บท 6 ═══ */}
      {maxSection >= 6 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 6</span> วันมงคล / วันระวัง (เดือนนี้)</h2>
          <p className="lede">{d.narrative["6"] ?? "วันมงคล = ทำธุรกรรมใหญ่ · วันระวัง = งดเสี่ยง"}</p>
          <h3>ธาตุเดือนนี้</h3>
          <p>ธาตุเดือน: {d.monthAdvice.element ?? "-"} ({d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"}) — {d.monthAdvice.text}</p>
          <h3>วันมงคล ({d.auspiciousDays.month.goodDayCount} วัน)</h3>
          <div className="day-grid green">{d.auspiciousDays.month.goodDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <h3>วันระวัง ({d.auspiciousDays.month.avoidDayCount} วัน)</h3>
          <div className="day-grid red">{d.auspiciousDays.month.avoidDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <div className="callout good"><b>วิธีใช้</b>ซื้อก้อน/เซ็นสัญญาในวันมงคล · วันระวัง = งดเสี่ยง เก็บเงินสด · ธาตุเดือนหนุน → เพิ่มน้ำหนัก ขัด → ลด</div>
        </section>
      ) : locked(6, "วันมงคล / วันระวัง (รายเดือน)")}

      {/* ═══ บท 7: ฉบับเดือนนี้ (VIP ของสด) ═══ */}
      {maxSection >= 6 ? (
        <section className="page">
          <h2 className="chap-head"><span>บทที่ 7</span> ฉบับเดือนนี้ — ของสด VIP</h2>
          <p className="lede">ส่วนนี้คือ "ของสด" ของสมาชิก VIP — อัปเดตทุกเดือนตามธาตุเดือนที่เปลี่ยนไป (เนื้อหาส่วนอื่นเป็นพื้นฐานคงที่)</p>
          <h3>ธาตุเดือนนี้ — หนุนหรือขัดดวง</h3>
          <div className={`callout ${d.monthAdvice.fit === "good" ? "good" : d.monthAdvice.fit === "avoid" ? "warn" : "info"}`}>
            <b>ธาตุเดือน: {d.monthAdvice.element ?? "-"} ({d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"})</b>
            {d.monthAdvice.text}
          </div>
          <h3>ปฏิทินมงคลทั้งเดือน</h3>
          <p className="green"><b>วันมงคล {d.auspiciousDays.month.goodDayCount} วัน</b> (เหมาะซื้อก้อน/เซ็นสัญญา)</p>
          <div className="day-grid green">{d.auspiciousDays.month.goodDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <p className="red"><b>วันระวัง {d.auspiciousDays.month.avoidDayCount} วัน</b> (งดเสี่ยง)</p>
          <div className="day-grid red">{d.auspiciousDays.month.avoidDays.map((g) => <span key={g.date}>{g.date}</span>)}</div>
          <div className="callout good">
            <b>สิ่งที่ต้องทำเดือนนี้</b>
            {d.monthAdvice.fit === "good"
              ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} หนุนดวง → เพิ่มน้ำหนักสินทรัพย์ธาตุ ${d.strengthen.element} ได้ · ทำธุรกรรมใหญ่ในวันมงคล · ทยอย DCA ตามแผน`
              : d.monthAdvice.fit === "avoid"
                ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} ขัดดวง → ลดความเสี่ยง งดซื้อก้อนใหญ่ เก็บเงินสดในวันระวัง · รอเดือนหน้า`
                : "เดือนนี้ธาตุกลาง → ทำตามแผนปกติ ทยอยสะสมในวันมงคล อย่าเปลี่ยนกลยุทธ์กลางคัน"}
          </div>
          <div className="callout warn"><b>กฎเหล็ก 5 ข้อ (ทุกเดือน)</b>1) ซื้อเฉพาะวันมงคล · 2) ไม่เกิน 5% ต่อตัว · 3) ผ่านเช็กลิสต์ 30 ข้อก่อน · 4) เงินฉุกเฉินห้ามแตะ · 5) ธาตุเดือนขัด = ลดน้ำหนัก</div>
        </section>
      ) : locked(7, "ฉบับเดือนนี้ (ของสด VIP)")}

      {/* ═══ ภาคผนวก ═══ */}
      {maxSection >= 3 && (
        <>
          <section className="page">
            <h2 className="chap-head"><span>ภาคผนวก ก</span> เช็กลิสต์ก่อนลงทุน (30 ข้อ)</h2>
            <p className="lede">ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 24/30 ขึ้นไปถึงเริ่ม (ข้อไหนไม่ได้ = หยุดก่อน)</p>
            {[
              `หุ้นธาตุ = ${d.strengthen.element} หรือธาตุที่ควรทำ (ไม่ใช่ ${d.avoid.join("/")})`,
              "fit ไม่ใช่ 'ขัดดวง' (ธาตุพิฆาต)",
              "fit ไม่ใช่ 'ดูดพลัง' ถ้าดิถีอ่อน",
              "เทียร์ไม่ใช่ INFO (เทียร์ 4 = ยังไม่ควรแตะ)",
              "อยู่ในช่วงวัยจรที่ไม่ใช่ 'เลี่ยง/ห้ามเสี่ยง'",
              "สัดส่วนเงินเย็น/เร็ว/ฉุกเฉินยังคงเดิม",
              "ซื้อเฉพาะวันมงคล (บท 6)",
              "ไม่ซื้อเกิน 5% ของพอร์ตต่อตัวเดียว",
              "มีเหตุผลเขียนได้ 1 บรรทัด (ธุรกิจ+ธาตุ+เทียร์)",
              "หุ้นใหญ่/สภาพคล่องดี (เล็ก = เงินเร็วเท่านั้น)",
              "DCA ดีกว่าซื้อทีเดียวถ้าวัยจร 'สะสม'",
              "ไม่ใช้เงินกู้/มาร์จิ้น (ดิถีอ่อนยิ่งห้าม)",
              "ตั้งจุดตัดขาดทุนไว้ก่อนซื้อ (เช่น -15%)",
              "ธาตุเดือนนี้ไม่ขัด (บท 7)",
              "หุ้นมีธาตุชัดเจน (ไม่ใช่ธาตุคลุมเครือ)",
              "พื้นฐาน: ROE ≥ 15% หรือ Buffett ผ่าน (ถ้ามีข้อมูล)",
              "ราคาไม่แพงเกิน: PE ไม่สูงสุดเป็นประวัติการณ์",
              "เงินเย็นของเดือนนี้เหลือพอ (ไม่กู้เกิน)",
              "ซื้อแล้วถือได้ 1 ปีขึ้นไป (ไม่ใช่เล่นสั้น)",
              "มีเงินฉุกเฉิน 6 เดือนก่อนซื้อ",
              "เช็กข่าวลบรอบตัวหุ้น (อัปเดต 1 สัปดาห์)",
              "ไม่ซื้อตามกระแสโซเชียล (ดวงไม่เอื้อ)",
              "พอร์ตไม่ซ้ำธาตุเดียวเกิน 40%",
              "วันนี้ไม่ใช่วันระวัง/ผั่วไฉ่โข่ว",
              "สินทรัพย์ตรงกับกองที่ตั้งไว้ (เย็น/เร็ว/ฉุกเฉิน)",
              "หุ้น IPO: ธาตุบริษัทชัดเจน + รอผ่านวันขึ้น 1 สัปดาห์",
              "ไม่ได้ใช้เงินที่ต้องใช้ใน 6 เดือน",
              "เข้าใจธุรกิจของหุ้น (อธิบายได้ 2 ประโยค)",
              "ตั้งเป้าหมายกำไร/ขายไว้ล่วงหน้า",
              "ผ่านเกณฑ์ 24/30 ขึ้นไป",
            ].map((c) => (
              <div key={c} className="check-row"><span className="check" />{c}</div>
            ))}
          </section>
          <section className="page">
            <h2 className="chap-head"><span>ภาคผนวก ข</span> อภิธานศัพท์</h2>
            {[
              ["ธาตุ", "พลัง 5 ชนิด (ไม้/ไฟ/ดิน/ทอง/น้ำ) — ทุกสิ่งมีธาตุ: คน ธุรกิจ หุ้น สินทรัพย์ ตลาด"],
              ["กำลังดิถี", "ความแข็ง-อ่อนของวันเกิด — อ่อน = ต้องเสริม อย่าไล่ลาภ / แข็ง = ถ่ายเทได้"],
              ["ธาตุลาภ", "ธาตุที่เป็น 'เงิน' ของดวง — ลงทุนธุรกิจธาตุนี้ได้ผล แต่ถ้าเกิน = ดูดพลัง"],
              ["ธาตุพิฆาต", "ธาตุที่ทำลายดวง — ห้ามแตะธุรกิจ/หุ้นธาตุนี้"],
              ["วัยจร", "วงจร 10 ปีของดวง (แบ่ง 5 ปีในเล่มนี้) — กำหนดจังหวะรวย/ระวัง"],
              ["เชี่ยงแซ", "ระดับพลังของธาตุลาภในแต่ละวัย (ซี่/เจ๊าะ = ห้ามเสี่ยง)"],
              ["ดิถี", "วันเกิดในปฏิทินจีน — ตัวแทน 'ตัวตน' ของดวง"],
              ["เทียร์ 1-4", "VIP / PRO / FREE / INFO — ระดับคุณภาพคำแนะนำรายหุ้น"],
              ["fit 4 ระดับ", "ตรงดวง / กลาง / ดูดพลัง / ขัดดวง"],
              ["เงินเย็น/เร็ว/ฉุกเฉิน", "กองยาว / กองเทรด / กองกันภัย"],
              ["Life Map", "แผนที่ชีวิต 0-80+ ปี — แถบสีวัยจรบอกจังหวะลงทุน/สะสม/เลี่ยง"],
              ["วันมงคล", "วันที่ธาตุเอื้อต่อธุรกรรม — ใช้ซื้อก้อน/เซ็นสัญญา"],
            ].map(([t, def]) => (
              <div key={t} className="gloss-row"><b>{t}</b><span>{def}</span></div>
            ))}
          </section>
        </>
      )}

      {/* ═══ สรุป ═══ */}
      {maxSection >= 2 && d.narrative.summary && (
        <section className="page">
          <div className="summary-box">
            <h2>สรุป — ทำอะไรเป็นอันดับแรก</h2>
            <p>{d.narrative.summary}</p>
          </div>
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
        section.page h2.chap-head { margin: 0 0 12px; }
        h2.chap-head { font-size: 21px; color: #14532d; border-bottom: 3px solid #b8860b; padding-bottom: 6px; }
        h2.chap-head span { color: #b8860b; }
        h3 { color: #2b2417; font-size: 15px; margin: 16px 0 8px; }
        p.lede { color: #8a6d3b; font-size: 13px; line-height: 1.6; }
        .two-col { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin: 10px 0 4px; }
        .donut-wrap { position: relative; }
        .donut { border-radius: 50%; position: relative; }
        .donut-hole { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 50%; }
        .legend-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13.5px; }
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
        .toc-row b { color: #b8860b; width: 80px; }
        .gloss-mini { margin: 6px 0; padding-left: 18px; font-size: 12.5px; line-height: 1.7; }
        .gloss-row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px dashed #e0d9c8; font-size: 12px; }
        .gloss-row b { color: #14532d; }
        .gloss-row span { color: #555; }
        .check-row { display: flex; gap: 10px; align-items: center; padding: 5px 0; font-size: 12.5px; border-bottom: 1px dotted #e0d9c8; }
        .check { width: 14px; height: 14px; border: 1.5px solid #1e6f3e; border-radius: 4px; flex-shrink: 0; }
        .summary-box { border: 2px solid #b8860b; border-radius: 14px; background: #fdf6e3; padding: 18px; }
        .summary-box h2 { color: #14532d; margin: 0 0 8px; }
        .summary-box p { font-size: 13.5px; line-height: 1.8; color: #444; }
        .locked { background: #e9e5da; border-radius: 10px; padding: 22px; text-align: center; margin: 20px 0; }
        .locked b { color: #9a9388; font-size: 15px; }
        .locked div { color: #b8860b; font-size: 12.5px; margin-top: 6px; }
        /* ── ปก ── */
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
