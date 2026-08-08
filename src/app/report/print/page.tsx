"use client";

import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  buildReportToc,
  getReportManifest,
  type ReportManifest,
  type ReportPageId,
} from "../../../lib/report/product-system";
import {
  buildFinancialSnapshot,
  FINANCIAL_PRESETS,
  type FinancialInputs,
} from "../../../lib/report/financial-system";
import {
  REPORT_FINANCIAL_PARAM_KEYS,
  resolveFinancialInputs,
} from "../../../lib/report/report-input";
import styles from "./print.module.css";

type Fundamentals = {
  roe: number | null;
  buffett: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
};

type Pick = {
  ticker: string;
  name: string;
  business?: string;
  element: string;
  elementReason?: string;
  score: number;
  price?: number | null;
  fundamentals?: Fundamentals | null;
  valuation?: {
    pe: number | null;
    pbv: number | null;
    dividendYield: number | null;
    high52w: number | null;
    low52w: number | null;
    currency: string | null;
  };
  evidence?: {
    businessSource: string | null;
    elementSource: string | null;
    reviewStatus: string;
    reviewedBy: string | null;
  };
};

type TimelineItem = {
  ageRange: string;
  verdict: string;
  reaction?: string;
  advice: string;
};

type ReportData = {
  profile?: { birthDate: string; birthTime: string; gender: string; province: string };
  entitlement?: { tier: string; source: string; reportId?: string };
  financialInputs?: FinancialInputs;
  persona: {
    element?: string;
    name: string;
    emoji: string;
    band: string;
    bandLabel: string;
    style: string;
    strengths?: string;
    weaknesses?: string;
  };
  trading: {
    label: string;
    allowed: string;
    reason: string;
    split: { cold: number; fast: number; emergency: number };
  };
  principle: {
    mode: string;
    desc: string;
    supplementElement: string;
    outputElement: string;
    excessElement?: string;
    excessCount?: number;
    excessNote?: string;
  };
  strengthen: { element: string; businessHint: string; wealth: string };
  avoid: string[];
  elementBalance: Array<{ element: string; pct: number; count?: number }>;
  monthAdvice: { element?: string; fit?: string; text: string };
  auspiciousDays: {
    month: {
      goodDayCount: number;
      goodDays: Array<{ date: string }>;
      avoidDayCount: number;
      avoidDays: Array<{ date: string }>;
    };
  };
  timeline: TimelineItem[];
  thPicks: { updatedAt?: string | null; picks: Pick[] };
  disclaimer: string;
  generatedAt: string;
};

type PhaseMeta = { label: string; color: string; action: string };

type LifeBand = {
  range: string;
  verdict: string;
  meta: PhaseMeta;
  details: string;
  active: boolean;
};

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const ELEMENT_META: Record<string, { color: string; meaning: string }> = {
  ไม้: { color: "#657a61", meaning: "แรงผลัก การเติบโต และความคาดหวัง" },
  ไฟ: { color: "#a84332", meaning: "ความชัดเจน จังหวะ และการหล่อหลอม" },
  ดิน: { color: "#9b744a", meaning: "ตัวตน ฐานรองรับ และความมั่นคง" },
  ทอง: { color: "#ba9150", meaning: "ระบบ กติกา และผลผลิต" },
  น้ำ: { color: "#315f59", meaning: "เงิน โอกาส และการไหลเวียน" },
};

const ELEMENT_BEHAVIOR: Record<string, { gift: string; pressure: string; habit: string; metaphor: string }> = {
  ไม้: {
    gift: "มองเห็นการเติบโตและทางเลือกใหม่ได้ก่อนคนอื่น",
    pressure: "ขยายหลายเรื่องพร้อมกันจนเงินและความสนใจกระจาย",
    habit: "เลือกหนึ่งเป้าหมาย ตัดหนึ่งสิ่งที่ไม่จำเป็น และวัดความคืบหน้ารายสัปดาห์",
    metaphor: "สวนที่เติบโตดีเมื่อมีการตัดแต่ง",
  },
  ไฟ: {
    gift: "ตัดสินใจและขับเคลื่อนได้เร็วเมื่อภาพชัด",
    pressure: "เปลี่ยนความมั่นใจเป็นความรีบเมื่อบรรยากาศร้อนแรง",
    habit: "เขียนเหตุผลก่อนตัดสินใจและเว้นช่วงให้ข้อมูลเย็นลงหนึ่งรอบ",
    metaphor: "เตาที่ให้พลังเมื่อมีเชื้อเพลิงและขอบเขต",
  },
  ดิน: {
    gift: "สร้างฐาน รับผิดชอบ และมองความเสี่ยงที่คนอื่นข้าม",
    pressure: "รอความแน่นอนนานเกินไปแล้วเร่งตัดสินใจเมื่อกลัวพลาด",
    habit: "กำหนดข้อมูลขั้นต่ำ เส้นตาย และขนาดทดลองที่ย้อนกลับได้",
    metaphor: "ผืนดินที่แข็งแรงเมื่อรับน้ำในปริมาณพอดี",
  },
  ทอง: {
    gift: "คิดเป็นระบบ ใช้มาตรฐาน และแยกคุณภาพออกจากกระแสได้ดี",
    pressure: "ต้องการความถูกต้องมากจนตัดทางเลือกเร็วหรือยึดคะแนนมากเกินไป",
    habit: "ใช้ scorecard ควบคู่กับช่วงความไม่แน่นอนและเงื่อนไขเปลี่ยนใจ",
    metaphor: "เครื่องมือคมที่มีคุณค่าเมื่อเลือกใช้ถูกงาน",
  },
  น้ำ: {
    gift: "รับข้อมูล เห็นการไหลของเงิน และเชื่อมโยงโอกาสได้ไว",
    pressure: "รับทางเลือกมากเกินไปจนลังเล แล้วรีบเพราะกลัวตกขบวน",
    habit: "จำกัดแหล่งข้อมูล กำหนดปลายทางของเงิน และมีจุดหยุดค้น",
    metaphor: "สายน้ำที่สร้างคุณค่าเมื่อมีทางไหลและปลายทาง",
  },
};

const PHASE_META: Record<string, PhaseMeta> = {
  "no-risk": { label: "งดเสี่ยง", color: "#7b2f35", action: "กันเงินสด หยุดเงินก้อน และซ่อมฐาน" },
  avoid: { label: "ตั้งรับ", color: "#a84332", action: "รักษาฐานและลดการตัดสินใจที่ย้อนกลับยาก" },
  accumulate: { label: "สะสม", color: "#aa7b35", action: "ทยอยสร้างด้วยจำนวนและเวลาที่กำหนดไว้" },
  invest: { label: "ขยาย", color: "#315f59", action: "เพิ่มน้ำหนักอย่างมีเพดานและมีจุดทบทวน" },
};

const FALLBACK_PICK: Pick = {
  ticker: "-",
  name: "ยังไม่มีข้อมูลบริษัท",
  business: "รอข้อมูลตลาดรอบถัดไป",
  element: "-",
  score: 0,
};

const ReportManifestContext = createContext<ReportManifest | null>(null);

function formatThaiDate(value?: string): string {
  if (!value) return "ไม่ระบุ";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function formatShortDate(value?: string): string {
  if (!value) return "-";
  const [, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!month || !day) return value;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]}`;
}

function formatNumber(value?: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

function money(value: number): string {
  return `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function formatYield(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${formatNumber(value > 50 ? value / 100 : value)}%`;
}

function ageFromBirth(birthDate: string | undefined, asOf: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date(`${asOf.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(now.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function parseAgeRange(range?: string): [number, number] {
  const values = (range || "").match(/\d+/g)?.map(Number) ?? [];
  return [values[0] ?? 0, values[1] ?? values[0] ?? 0];
}

function ageRangeIncludes(range: string, age: number | null): boolean {
  if (age == null) return false;
  const [start, end] = parseAgeRange(range);
  return age >= start && age <= end;
}

function displayRange(range?: string): string {
  return (range || "-").replace(/[–—−]/g, "-");
}

function shorten(value?: string, limit = 150): string {
  const text = (value || "ยังไม่มีคำอธิบายในรอบข้อมูลนี้")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
}

function phaseText(verdict?: string): PhaseMeta {
  return PHASE_META[verdict || "avoid"] ?? PHASE_META.avoid;
}

function pickSignal(pick: Pick): string {
  const fundamentals = pick.fundamentals;
  if (!fundamentals || fundamentals.roe == null) return "ข้อมูลพื้นฐานยังไม่ครบ - รออ่านงบก่อน";
  if (fundamentals.roe < 0) return "กำไรและคุณภาพผลตอบแทนต้องตรวจเพิ่ม";
  if (fundamentals.roe >= 15 && (fundamentals.buffett ?? 0) >= 8) return "คุณภาพเด่นในชุดข้อมูล แต่ยังต้องดูราคา";
  return "ผ่านเข้ารอบศึกษา ยังไม่ใช่ข้อสรุปลงทุน";
}

function researchLens(pick: Pick): string {
  const lensByTicker: Record<string, string> = {
    BH: "บริการรักษาพยาบาลเฉพาะทาง รายได้เชื่อมกับกำลังซื้อและการเดินทางระหว่างประเทศ",
    BDMS: "เครือข่ายโรงพยาบาลขนาดใหญ่ ต้องพิสูจน์ว่าขนาดแปลงเป็นประสิทธิภาพและเงินสดได้",
    PTTEP: "ธุรกิจต้นน้ำพลังงาน กำไรไวต่อราคาขาย ต้นทุนโครงการ และวินัยการลงทุน",
    GULF: "โครงสร้างพื้นฐานพลังงาน ต้องอ่านคุณภาพสัญญา ผลตอบแทนโครงการ และภาระทุน",
    BANPU: "พอร์ตพลังงานหลายวัฏจักร ต้องเทียบเงินสดจากธุรกิจเดิมกับเงินลงทุนเปลี่ยนผ่าน",
  };
  return lensByTicker[pick.ticker] ?? shorten(pick.business, 145);
}

function monthFitLabel(fit?: string): string {
  const value = (fit || "").toLowerCase();
  if (value.includes("avoid") || value.includes("no-risk")) return "ลดความเร็วและเพิ่มหลักฐาน";
  if (value.includes("accumulate")) return "สะสมตามแผนโดยไม่เร่งผลลัพธ์";
  if (value.includes("invest")) return "ขยายอย่างมีเพดานและจุดทบทวน";
  return fit || "สังเกตจังหวะก่อนเพิ่มขนาด";
}

function monthNarrative(element?: string, fit?: string): string {
  const value = (fit || "").toLowerCase();
  if (value.includes("avoid") || value.includes("no-risk")) {
    return `เดือนธาตุ${element || "-"}เพิ่มแรงกดดันต่อฐานเดิม จึงเหมาะกับการเก็บหลักฐาน ลดขนาด และเดินตามแผนสะสม มากกว่าตัดสินใจด้วยเงินก้อน`;
  }
  if (value.includes("accumulate")) {
    return `เดือนธาตุ${element || "-"}เหมาะกับการต่อฐานทีละส่วน ใช้จำนวนเงินและวันที่กำหนดไว้แทนการเดาจุดต่ำสุด`;
  }
  if (value.includes("invest")) {
    return `เดือนธาตุ${element || "-"}เปิดพื้นที่ให้ขยายได้ แต่ทุกการเพิ่มน้ำหนักยังต้องผ่านหลักฐาน ราคา และเพดานความเสียหาย`;
  }
  return `ใช้เดือนธาตุ${element || "-"}เป็นสัญญาณให้ทบทวนระบบ ไม่ใช่คำทำนายทิศทางตลาด`;
}

function buildLifeBands(timeline: TimelineItem[], age: number | null): LifeBand[] {
  const bands = [
    { start: 0, end: 19, label: "0-19" },
    { start: 20, end: 34, label: "20-34" },
    { start: 35, end: 49, label: "35-49" },
    { start: 50, end: 64, label: "50-64" },
    { start: 65, end: 99, label: "65+" },
  ];
  const priority = ["no-risk", "avoid", "accumulate", "invest"];

  return bands.map((band) => {
    const matches = timeline.filter((item) => {
      const [start, end] = parseAgeRange(item.ageRange);
      return end >= band.start && start <= band.end;
    });
    const counts = new Map<string, number>();
    matches.forEach((item) => counts.set(item.verdict, (counts.get(item.verdict) ?? 0) + 1));
    const verdict = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return priority.indexOf(a[0]) - priority.indexOf(b[0]);
    })[0]?.[0] ?? "avoid";
    const details = matches.length
      ? matches.map((item) => `${displayRange(item.ageRange)} ${phaseText(item.verdict).label}`).join(" · ")
      : "ยังไม่มีข้อมูลวัยจรในช่วงนี้";
    return {
      range: band.label,
      verdict,
      meta: phaseText(verdict),
      details,
      active: age != null && age >= band.start && age <= band.end,
    };
  });
}

function Page({
  pageId,
  part,
  cue,
  title,
  children,
  className = "",
}: {
  pageId: ReportPageId;
  part?: string;
  cue?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const manifest = useContext(ReportManifestContext);
  const pageIndex = manifest?.pageIds.indexOf(pageId) ?? -1;
  if (!manifest || pageIndex < 0) return null;
  const number = pageIndex + 1;
  return (
    <section className={`page ${className}`} data-page-id={pageId} data-page-number={number}>
      {(part || title) && (
        <header className="page-head">
          <div className="folio">
            <b>{part}</b>
            {cue && <span>{cue}</span>}
          </div>
          {title && <h1>{title}</h1>}
        </header>
      )}
      {children}
      <footer>
        <span>ดวงนักลงทุน · PRIVATE BAZI EDITION</span>
        <b>{String(number).padStart(2, "0")}</b>
      </footer>
    </section>
  );
}

function MetricLine({ pick }: { pick: Pick }) {
  return (
    <div className="metric-line">
      <div><span>ROE</span><b>{formatYield(pick.fundamentals?.roe)}</b></div>
      <div><span>P/E</span><b>{formatNumber(pick.valuation?.pe)}</b></div>
      <div><span>ปันผล</span><b>{formatYield(pick.valuation?.dividendYield)}</b></div>
    </div>
  );
}

export default function PrintReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [tier, setTier] = useState("790");
  const [ips, setIps] = useState<FinancialInputs>(FINANCIAL_PRESETS.builder);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const localDraftId = params.get("localDraft");
    let input: Record<string, string> = Object.fromEntries(params.entries());
    if (localDraftId) {
      const stored = localStorage.getItem(`bazi-report-draft:${localDraftId}`);
      if (!stored) {
        setError("ไม่พบข้อมูลฉบับร่างในเครื่องนี้ กรุณาเปิดรายงานใหม่จากโรงงาน PDF");
        return;
      }
      try {
        input = JSON.parse(stored) as Record<string, string>;
      } catch {
        setError("ข้อมูลฉบับร่างเสียหาย กรุณาสร้างใหม่");
        return;
      }
    }
    const readInput = (key: string) => input[key] ?? null;
    const resolvedFinancial = resolveFinancialInputs(readInput, { allowDemo: true });
    setTier(resolvedFinancial.tier);
    setIps(resolvedFinancial.inputs);

    const reportInput: Record<string, string> = {
      birthDate: readInput("birthDate") || "1993-11-24",
      birthTime: readInput("birthTime") || "15:12",
      gender: readInput("gender") || "male",
      province: readInput("province") || "Bangkok",
      tier: resolvedFinancial.tier,
    };
    for (const key of REPORT_FINANCIAL_PARAM_KEYS) {
      const value = readInput(key);
      if (value != null) reportInput[key] = value;
    }
    const entitlement = readInput("entitlement");
    if (entitlement) reportInput.entitlement = entitlement;

    fetch("/api/report-html-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportInput),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.ok) {
          setError(payload.error ?? "โหลดรายงานไม่สำเร็จ");
          return;
        }
        if (payload.data?.entitlement?.tier) setTier(payload.data.entitlement.tier);
        if (payload.data?.financialInputs) setIps(payload.data.financialInputs);
        setData(payload.data);
        if (localDraftId) localStorage.removeItem(`bazi-report-draft:${localDraftId}`);
      })
      .catch((caught) => setError((caught as Error).message));
  }, []);

  const manifest = useMemo(() => getReportManifest(tier), [tier]);
  const financial = useMemo(() => buildFinancialSnapshot(ips), [ips]);
  const tocRows = useMemo(() => buildReportToc(manifest), [manifest]);

  const derived = useMemo(() => {
    if (!data) return null;
    const age = ageFromBirth(data.profile?.birthDate, data.generatedAt);
    const currentPhase = data.timeline.find((phase) => ageRangeIncludes(phase.ageRange, age)) ?? data.timeline[0];
    const elementByName = Object.fromEntries(data.elementBalance.map((item) => [item.element, item]));
    const picks = data.thPicks.picks.slice(0, 5);
    const health = picks.filter((pick) => /โรงพยาบาล|แพทย์|สุขภาพ/.test(`${pick.name} ${pick.business}`));
    const energy = picks.filter((pick) => !health.includes(pick));
    return {
      age,
      currentPhase,
      currentPhaseMeta: phaseText(currentPhase?.verdict),
      elementByName,
      picks,
      health,
      energy,
      selected: financial.allocationModel,
      lifeBands: buildLifeBands(data.timeline, age),
    };
  }, [data, financial.allocationModel]);

  if (error) {
    return <main className={styles.book}><div className="load-state error">{error}</div></main>;
  }

  if (!data || !derived) {
    return <main className={styles.book}><div className="load-state">กำลังเรียบเรียงหนังสือเฉพาะบุคคล…</div></main>;
  }

  const d = data;
  const sortedElements = [...d.elementBalance].sort((a, b) => b.pct - a.pct);
  const dominantElement = sortedElements[0] ?? { element: d.persona.element || "ดิน", pct: 0 };
  const secondElement = sortedElements[1] ?? dominantElement;
  const supportElement = d.principle.supplementElement || d.strengthen.element;
  const supportPct = derived.elementByName[supportElement]?.pct ?? 0;
  const behavior = ELEMENT_BEHAVIOR[dominantElement.element] ?? ELEMENT_BEHAVIOR.ดิน;
  const supportBehavior = ELEMENT_BEHAVIOR[supportElement] ?? ELEMENT_BEHAVIOR.ดิน;
  const dominantMeta = ELEMENT_META[dominantElement.element] ?? ELEMENT_META.ดิน;
  const supportMeta = ELEMENT_META[supportElement] ?? ELEMENT_META.ไฟ;
  const birthLabel = `${formatThaiDate(d.profile?.birthDate)} · ${d.profile?.birthTime || "ไม่ระบุเวลา"} · ${d.profile?.province || "ไม่ระบุสถานที่"}`;
  const marketDate = formatThaiDate(d.thPicks.updatedAt || d.generatedAt);
  const coldAmount = ips.capital * d.trading.split.cold / 100;
  const fastAmount = ips.capital * d.trading.split.fast / 100;
  const emergencyAmount = ips.capital * d.trading.split.emergency / 100;
  const selected = derived.selected;
  const equityAmount = coldAmount * selected.allocation.equity / 100;
  const bondAmount = coldAmount * selected.allocation.bond / 100;
  const cashAmount = coldAmount * selected.allocation.cash / 100;
  const stressLoss = equityAmount * 0.2;
  const stressPct = ips.capital > 0 ? stressLoss / ips.capital * 100 : 0;
  const currentPhase = derived.currentPhaseMeta;
  const bh = derived.picks.find((pick) => pick.ticker === "BH") ?? derived.health[0] ?? derived.picks[0] ?? FALLBACK_PICK;
  const bdms = derived.picks.find((pick) => pick.ticker === "BDMS") ?? derived.health.find((pick) => pick !== bh) ?? derived.picks[1] ?? FALLBACK_PICK;
  const energyPicks = ["PTTEP", "GULF", "BANPU"]
    .map((ticker) => derived.picks.find((pick) => pick.ticker === ticker))
    .filter((pick): pick is Pick => Boolean(pick));
  const energyRows = energyPicks.length >= 3 ? energyPicks : [...energyPicks, ...derived.energy.filter((pick) => !energyPicks.includes(pick))].slice(0, 3);
  while (energyRows.length < 3) energyRows.push(FALLBACK_PICK);
  const goodDays = d.auspiciousDays.month.goodDays.slice(0, 6).map((item) => formatShortDate(item.date)).join(" · ") || "ไม่มีวันเด่นในรอบข้อมูล";
  const avoidDays = d.auspiciousDays.month.avoidDays.slice(0, 6).map((item) => formatShortDate(item.date)).join(" · ") || "ไม่มีวันเตือนในรอบข้อมูล";

  const answers = [
    {
      label: "สไตล์ที่เข้ากับคุณ",
      answer: d.persona.style || "ตัดสินใจเป็นระบบและใช้ขนาดที่ย้อนกลับได้",
      reason: `ตัวตน ${d.persona.name} อยู่ระดับ ${d.persona.bandLabel}; ธาตุ${dominantElement.element} ${formatNumber(dominantElement.pct)}% ทำให้คุณ${behavior.gift} แต่เมื่อกดดันอาจ${behavior.pressure}`,
    },
    {
      label: "ฐานการเงินจริง",
      answer: `${financial.effectiveRisk} · เงินสำรอง ${formatNumber(financial.runwayMonths)} เดือน`,
      reason: ips.isDemo
        ? "หน้านี้ใช้ชุดข้อมูลสาธิตเพื่อทดสอบรูปแบบ รายงานจ่ายเงินจริงต้องดึงข้อมูลที่ผู้ใช้ยืนยันจากระบบ"
        : `เงินเหลือจริง ${money(financial.monthlySurplus)} ต่อเดือน และลงทุนได้โดยไม่เกิน ${money(financial.investableMonthly)} ต่อเดือน`,
    },
    {
      label: "ธีมธุรกิจที่ควรศึกษา",
      answer: `${d.strengthen.element} เป็นเลนส์ค้นหา ไม่ใช่คำสั่งซื้อ`,
      reason: `เริ่มจาก ${d.strengthen.businessHint} แล้วผ่านงบ ราคา ความเสี่ยง และเหตุผลที่คุณเข้าใจได้ทุกครั้ง`,
    },
    {
      label: "จังหวะตอนนี้",
      answer: `${currentPhase.label} - ${currentPhase.action}`,
      reason: `อายุ ${derived.age ?? "-"} อยู่ในช่วง ${displayRange(derived.currentPhase?.ageRange)} ปี; ใช้จังหวะนี้กำหนดขนาดการตัดสินใจ ไม่ใช่ทำนายราคาหุ้น`,
    },
  ];

  const reportStyle = {
    "--profile-accent": dominantMeta.color,
    "--profile-support": supportMeta.color,
  } as CSSProperties;

  return (
    <main className={styles.book} style={reportStyle} data-report-tier={manifest.config.tier} data-report-version={manifest.version}>
      <ReportManifestContext.Provider value={manifest}>
      <div className="toolbar no-print">
        <button onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
        <span>{manifest.config.priceLabel} · {manifest.pageCount} หน้า · A4 · Scale 100% · เปิด Background graphics</span>
      </div>

      <Page pageId="cover" className="cover">
        <div className="cover-copy">
          <div className="cover-kicker">PERSONAL BAZI · {manifest.config.displayName}</div>
          <h1>แผนที่เงินของ<span>{d.persona.name}</span></h1>
          <p className="cover-deck">{manifest.config.promise}</p>
        </div>
        <div className="cover-profile">
          <b>{birthLabel}</b>
          <span>ตัวตนธาตุ{d.persona.element || "ดิน"} · ธาตุลาภ{d.strengthen.wealth} · ธาตุที่ใช้เสริม{d.strengthen.element}</span>
        </div>
        <div className="cover-edition">{manifest.config.priceLabel}<br />{manifest.pageCount} PAGES</div>
      </Page>

      <Page pageId="letter" part="บทนำ" cue="จดหมายถึงเจ้าของเล่ม" title={`${behavior.metaphor}: จุดแข็งของคุณต้องการขอบเขตที่เหมาะสม`}>
        <div className="letter-layout">
          <div className="letter-copy">
            <p className="opening">ถึงเจ้าของดวง {d.persona.name},</p>
            <p>สิ่งที่เล่มนี้เห็นไม่ใช่คำตัดสินว่าคุณเก่งหรือไม่เก่งเรื่องเงิน แต่เป็นรูปแบบแรงกดดันที่เกิดซ้ำ ธาตุ{dominantElement.element}เด่น {formatNumber(dominantElement.pct)}% สะท้อนว่าคุณ{behavior.gift} ขณะเดียวกัน เมื่อข้อมูลหรืออารมณ์มากเกินขอบเขต คุณอาจ{behavior.pressure}</p>
            <p>คำว่า “{d.persona.bandLabel}” ไม่ได้ใช้ติดป้ายคุณ แต่ใช้กำหนดว่าการตัดสินใจควรเล็กหรือใหญ่เพียงใด ทางออกจึงไม่ใช่ฝืนบุคลิก แต่คือทำให้เงินแต่ละก้อนมีหน้าที่ มีเพดานความเสียหาย และมีวันที่ทบทวนก่อนลงมือ</p>
            <p>ธาตุที่ระบบเสนอให้สร้างคือ{supportElement} ซึ่งมีน้ำหนัก {formatNumber(supportPct)}% ในดวงนี้ ภาษาของชีวิตจริงจึงไม่ใช่การซื้อสินทรัพย์ธาตุ{supportElement}โดยอัตโนมัติ แต่คือการฝึกว่า “{supportBehavior.habit}”</p>
            <p>เป้าหมายของหนังสือไม่ใช่บอกว่าหุ้นใดจะขึ้น แต่ช่วยให้คุณตอบสามคำถามได้ชัด: เงินก้อนนี้มีหน้าที่อะไร เหตุผลที่ถือยังอยู่หรือไม่ และถ้าผิดคุณเสียหายได้แค่ไหน</p>
            <p className="letter-sign">ขอให้เล่มนี้ทำหน้าที่เป็นเข็มทิศ ไม่ใช่คำสั่ง</p>
          </div>
          <aside className="margin-note">
            <span>คำแปลสำคัญ</span>
            <h3>ดวงบอก “รูปแบบแรงกดดัน” ไม่ได้บอกราคาหุ้นในอนาคต</h3>
            <p>ทุกตัวเลขตลาดในเล่มเป็นข้อมูลเพื่อศึกษา ต้องตรวจงบ ราคา ข่าว และความเหมาะสมทางการเงินของคุณอีกครั้ง</p>
          </aside>
        </div>
        <div className="letter-prompts">
          <b>สามคำถามก่อนทุกการตัดสินใจ</b>
          <span>เงินก้อนนี้มีหน้าที่อะไร</span>
          <span>หลักฐานใดทำให้ฉันเปลี่ยนใจ</span>
          <span>ถ้าผิด ชีวิตเสียรูปแค่ไหน</span>
        </div>
      </Page>

      <Page pageId="contents" part="แผนที่เล่ม" cue={`${manifest.config.priceLabel} · ${manifest.pageCount} หน้า · ${manifest.version}`} title="อ่านตามคำถาม ไม่ต้องอ่านตามลำดับหน้า">
        <div className="toc-list">
          {tocRows.map((row) => (
            <div className="toc-row" key={row.number}>
              <b>{row.number}</b>
              <div><h2>{row.question}</h2><p>{row.description}</p></div>
              <span>{row.pages}</span>
            </div>
          ))}
        </div>
        <div className="reading-promise">
          <b>วิธีอ่าน</b>
          <p>ทุกส่วนเดินตามลำดับเดียวกัน: <strong>คำตอบ → เหตุผล → หลักฐาน → การกระทำ</strong> หากหน้าใดไม่มีผลต่อการตัดสินใจของคุณ ให้ข้ามได้ทันที</p>
        </div>
      </Page>

      <Page pageId="executive" part="สรุปผู้บริหาร" cue="คำตอบก่อนรายละเอียด" title="คำตอบสี่ข้อที่ควรจำ แม้คุณปิดเล่มตรงนี้">
        <div className="answer-list">
          {answers.map((item, index) => (
            <div className="answer-row" key={item.label}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{item.label}</span>
              <div><h2>{item.answer}</h2><p>{item.reason}</p></div>
            </div>
          ))}
        </div>
        <blockquote className="answer-quote">“รายงานที่ดีไม่ได้ทำให้คุณกล้าเสี่ยงขึ้น แต่ทำให้คุณรู้ว่าเงินก้อนไหนรับความเสี่ยงได้ เพราะอะไร และเมื่อไรต้องหยุด”</blockquote>
      </Page>

      <Page pageId="confidence" part="ขอบเขตข้อมูล" cue="รู้สิ่งที่รู้ และไม่แต่งสิ่งที่หาย" title="รายงานฉบับนี้รู้อะไร มั่นใจเพียงใด และยังตอบอะไรไม่ได้">
        <div className="confidence-grid">
          <article><span>ข้อมูลเกิด</span><b>พร้อมคำนวณ</b><p>{birthLabel}</p><small>หากเวลาเกิดคลาดเคลื่อน ผลส่วนที่อิงยามอาจเปลี่ยน</small></article>
          <article><span>ข้อมูลการเงิน</span><b>{financial.confidence}</b><p>{ips.isDemo ? "ชุดสาธิตสำหรับตรวจระบบ" : "ข้อมูลที่ผู้ใช้ระบุ"}</p><small>{ips.isDemo ? "ห้ามใช้ฉบับนี้ส่งมอบลูกค้า" : "ยังต้องทบทวนเมื่อรายรับ หนี้ หรือเป้าหมายเปลี่ยน"}</small></article>
          <article><span>ข้อมูลตลาด</span><b>ณ {marketDate}</b><p>{d.thPicks.picks.length} บริษัทในคิวศึกษา</p><small>ราคาและอัตราส่วนอาจเปลี่ยนหลังวันที่ระบุ</small></article>
          <article><span>ขอบเขตคำตอบ</span><b>วางแผน ไม่ทำนายราคา</b><p>BaZi ใช้อธิบายพฤติกรรมและจังหวะทบทวน</p><small>หุ้นทุกตัวเป็น research candidate ไม่ใช่คำสั่งซื้อ</small></article>
        </div>
        <div className="confidence-rule"><b>กฎส่งมอบ</b><span>ข้อเท็จจริงจากผู้ใช้</span><span>ผลคำนวณ</span><span>การตีความ</span><span>สมมติฐาน</span></div>
      </Page>

      <Page pageId="balance" part="ภาค 1 · โครงสร้างดวง" cue="หลักฐานจากสมดุลธาตุ" title="ไม่ใช่ดูว่าธาตุใดดีหรือร้าย แต่ดูว่าแรงใดดังเกินไปและแรงใดเงียบเกินไป">
        <div className="balance-layout">
          <div className="balance-lead">
            <span>ภาพรวมตัวตน</span>
            <b>{d.persona.name}</b>
            <h2>{d.persona.bandLabel}</h2>
            <p>แกนตัวตนธาตุ{d.persona.element || "ดิน"}ต้องใช้พลังมากเมื่อรับแรงหลายด้าน ระบบจึงเน้นเสริมฐานด้วย{d.principle.supplementElement} และเปลี่ยนธาตุ{d.principle.outputElement}ให้เป็นกติกาที่ใช้ซ้ำได้</p>
          </div>
          <div className="balance-bars">
            {d.elementBalance.map((item) => {
              const meta = ELEMENT_META[item.element] ?? { color: "#777", meaning: "แรงประกอบในดวง" };
              return (
                <div className="balance-bar" key={item.element} style={{ "--element-color": meta.color } as CSSProperties}>
                  <span>{item.element}</span>
                  <i><b style={{ width: `${Math.max(item.pct, 1)}%` }} /></i>
                  <b>{formatNumber(item.pct)}%</b>
                </div>
              );
            })}
          </div>
        </div>
        <div className="interpretation">
          <article><span>แรงที่นำ</span><h3>{dominantElement.element} {formatNumber(dominantElement.pct)}%</h3><p>{behavior.gift} จุดที่ต้องระวังคือ{behavior.pressure}</p></article>
          <article><span>แรงรอง</span><h3>{secondElement.element} {formatNumber(secondElement.pct)}%</h3><p>{ELEMENT_META[secondElement.element]?.meaning || "แรงประกอบในดวง"} เป็นบริบทที่ทำให้แรงหลักแสดงออกต่างกันในแต่ละสถานการณ์</p></article>
          <article><span>แรงที่ต้องสร้าง</span><h3>{supportElement} {formatNumber(supportPct)}%</h3><p>{supportBehavior.habit} นี่คือพฤติกรรมที่ฝึกได้ ไม่ใช่เหตุผลให้ซื้อสินทรัพย์ตามธาตุโดยอัตโนมัติ</p></article>
        </div>
      </Page>

      <Page pageId="persona" part="ภาค 1 · ภาพบุคลิก" cue="แปลดวงเป็นภาษาคน" title={`${d.persona.name}: ${behavior.metaphor}`}>
        <div className="portrait-lead">
          <div className="portrait-word">{d.persona.name}</div>
          <blockquote>“{behavior.gift} แต่คุณภาพของผลลัพธ์ขึ้นกับขอบเขตที่ตั้งไว้ก่อนแรงกดดันจะเข้ามา”</blockquote>
        </div>
        <div className="prose-columns">
          <p>ในวันที่ข้อมูลและแรงกดดันอยู่ในขอบเขต จุดแข็งของคุณคือการ{behavior.gift} ความสามารถนี้เหมาะกับการลงทุนที่มีสมมติฐาน มีช่วงเวลารอ และมีหลักฐานให้กลับมาตรวจ มากกว่าการพยายามชนะทุกการเคลื่อนไหวของราคา</p>
          <p>เมื่อแรงธาตุ{dominantElement.element}ทำงานเกินสมดุล รูปแบบที่ควรจับตาคือการ{behavior.pressure} สัญญาณเตือนไม่ใช่ความรู้สึกไม่ดีเพียงอย่างเดียว แต่คือการเปลี่ยนเหตุผล ขนาด หรือกรอบเวลาโดยไม่ได้เขียนไว้ก่อน</p>
          <p>คำแนะนำจากธาตุ{supportElement}คือ “{supportBehavior.habit}” หากทำสิ่งนี้ได้ก่อนเปิดแอปลงทุน คุณจะเปลี่ยนคำอ่านเชิงสัญลักษณ์ให้เป็นระบบที่วัดผลได้</p>
          <p>ข้อควรระวังคืออย่าใช้คำว่าดวงเป็นเหตุผลสุดท้าย รายงานนี้ให้สมมติฐานเรื่องพฤติกรรม ส่วนกิจการ ราคา หนี้ สภาพคล่อง และเป้าหมายชีวิตต้องเป็นผู้ตัดสินขนาดเงินจริงเสมอ</p>
        </div>
        <div className="portrait-signs">
          <div><b>เมื่ออยู่ในสมดุล</b><span>{behavior.gift}</span></div>
          <div><b>เมื่อถูกกดดัน</b><span>{behavior.pressure}</span></div>
          <div><b>ประโยคช่วยหยุด</b><span>“ข้อมูลใหม่เปลี่ยนสมมติฐานข้อใด?”</span></div>
        </div>
      </Page>

      <Page pageId="wealth-flow" part="ภาค 1 · เงินในภาษาดวง" cue={`ธาตุลาภ${d.strengthen.wealth}เป็นเลนส์ ไม่ใช่คำรับประกัน`} title={`จัดทิศทางของเงินก่อนตีความธาตุลาภ${d.strengthen.wealth}`}>
        <div className="water-sentence">
          <b>{d.strengthen.wealth}</b>
          <h2>ธาตุลาภบอกภาษาที่ใช้มองโอกาส แต่หน้าที่ของเงิน ระยะเวลา และความเสียหายที่รับได้เป็นตัวกำหนดการลงทุนจริง</h2>
        </div>
        <div className="flow-line">
          <div className="flow-stop"><span>ต้นทาง</span><h3>โอกาสถูกมองเห็น</h3><p>ธาตุ{dominantElement.element}ทำให้คุณ{behavior.gift} จึงต้องแยกว่าโอกาสใดตรงเป้าหมายและโอกาสใดเพียงน่าสนใจ</p></div>
          <div className="flow-stop"><span>ตัวกรอง</span><h3>ผ่านข้อมูลจริง</h3><p>ให้ผ่านสามด่าน: เข้าใจรายได้ ตรวจฐานะการเงิน และรู้ว่าราคาเผื่อความหวังไปเท่าไร</p></div>
          <div className="flow-stop"><span>ปลายทาง</span><h3>กำหนดหน้าที่เงิน</h3><p>เงินที่ต้องใช้เร็วห้ามรับความผันผวนแบบเดียวกับเงินที่รอได้สิบปี</p></div>
        </div>
        <div className="editorial-callout">
          <b>สิ่งที่มักเข้าใจผิด</b>
          <p>ธาตุลาภไม่ได้แปลว่า “จะรวยจากธุรกิจธาตุนั้น” ความหมายที่ใช้ได้จริงคือใช้เป็นคำถามตั้งต้น แล้วให้กระแสเงินสด คุณภาพกิจการ ราคา ความเสี่ยง และความเหมาะสมของพอร์ตเป็นผู้ตัดสิน</p>
        </div>
      </Page>

      <Page pageId="support-habit" part="ภาค 1 · ธาตุที่ต้องสร้าง" cue={`เปลี่ยน${supportElement}จากสัญลักษณ์เป็นพฤติกรรม`} title={`ธาตุ${supportElement}ไม่ต้องซื้อจากตลาด คุณสร้างได้ด้วยนิสัยที่ใช้ซ้ำ`}>
        <div className="fire-layout">
          <div className="fire-zero"><div><b>{formatNumber(supportPct)}%</b><span>{supportElement}ในผังนี้</span></div></div>
          <div className="fire-intro">
            <h2>{supportBehavior.habit}</h2>
            <p>ถ้าตีความเพียงว่าต้องซื้อธุรกิจธาตุ{supportElement} คุณจะได้รายชื่อหุ้น แต่ยังไม่ได้ระบบตัดสินใจ สิ่งที่ใช้ได้จริงคือคุณภาพของกระบวนการ</p>
          </div>
        </div>
        <div className="practice-list">
          {[
            ["01", `${supportElement}ของเวลา`, "กำหนดวันอ่าน วันตัดสินใจ และวันทบทวนแยกกัน ห้ามตัดสินใจทันทีหลังอ่านข่าวชิ้นแรก"],
            ["02", `${supportElement}ของขอบเขต`, `จำกัดบริษัทที่ศึกษาไม่เกิน 5 ตัว และขนาดทดลองไม่เกินกองเงินเร็ว ${money(fastAmount)}`],
            ["03", `${supportElement}ของหลักฐาน`, "เขียนเหตุผลถือ 3 ข้อและเหตุผลออก 2 ข้อ ถ้าเขียนไม่ได้ แปลว่ายังมีเพียงความรู้สึก"],
            ["04", `${supportElement}ของการปิด`, "เมื่อข้อมูลครบตามเช็กลิสต์ ให้เลือก ทำหรือไม่ทำ แล้วบันทึกเหตุผลก่อนดูผลลัพธ์"],
          ].map(([no, title, text]) => (
            <div className="practice-row" key={no}><b>{no}</b><h3>{title}</h3><p>{text}</p></div>
          ))}
        </div>
        <div className="editorial-callout"><b>จำไว้</b><p>ธาตุ{supportElement}ในเล่มนี้คือพฤติกรรมที่ช่วยคืนสมดุล ไม่ใช่เหตุผลให้เพิ่มหุ้นธีม{supportElement} หากกิจการ งบ ราคา หรือขนาดไม่ผ่าน ธาตุที่เข้ากันก็ไม่ทำให้การลงทุนนั้นปลอดภัยขึ้น</p></div>
      </Page>

      <Page pageId="decision-loop" part="ภาค 1 · วงจรการตัดสินใจ" cue="เห็นจุดที่อารมณ์แทรกก่อนแก้" title={`วงจรที่ทำให้จุดแข็งของธาตุ${dominantElement.element}กลายเป็นแรงกดดัน`}>
        <div className="loop-grid">
          {[
            ["01", "แรงหลักทำงาน", behavior.gift],
            ["02", "ขอบเขตหาย", behavior.pressure],
            ["03", "แรงเร่งเกิด", "ราคาเคลื่อนหรือคนอื่นเริ่มพูดถึง ทำให้กลัวพลาดมากกว่ากลัวซื้อผิด"],
            ["04", "ตัดสินใจใหญ่", "ใช้เงินเกินขนาดทดลองเพื่อชดเชยเวลาที่รู้สึกว่าเสียไป"],
            ["05", "ทนการแกว่งไม่ได้", "เพราะเหตุผลยังไม่ชัด การลดลงเล็กน้อยจึงรู้สึกเหมือนหลักฐานว่าคิดผิด"],
            ["06", "กลับไปหาข้อมูล", "อ่านเพื่อปลอบใจหรือหาคนยืนยัน แทนที่จะทดสอบสมมติฐานเดิม"],
          ].map(([no, title, text]) => (
            <div className="loop-step" key={no}><b>{no}</b><h3>{title}</h3><p>{text}</p></div>
          ))}
        </div>
        <div className="interrupt">
          <h2>จุดตัดวงจร</h2>
          <p>หยุดก่อนข้อ 3 แล้วถามว่า <strong>“ถ้าราคานิ่งอยู่ 30 วัน ฉันยังอยากเป็นเจ้าของกิจการนี้หรือไม่?”</strong> ถ้าคำตอบไม่ชัด ให้กลับไปที่สมมติฐาน ไม่ใช่กลับไปดูกราฟถี่ขึ้น</p>
        </div>
      </Page>

      <Page pageId="financial-snapshot" part="ภาค 2 · ฐานะการเงิน" cue={ips.isDemo ? "DEMO DATA · ห้ามส่งมอบลูกค้า" : "ข้อมูลที่ผู้ใช้ระบุ"} title="ก่อนถามว่าจะลงทุนอะไร ต้องเห็นก่อนว่าชีวิตเหลือพื้นที่ให้ลงทุนเท่าไร">
        <div className="financial-ledger">
          <div><span>รายรับสุทธิ/เดือน</span><b>{money(ips.monthlyIncome)}</b><p>ฐานที่ใช้คำนวณความสามารถรับความเสี่ยง</p></div>
          <div><span>ค่าใช้จ่าย/เดือน</span><b>{money(ips.monthlyExpense)}</b><p>ไม่รวมผลตอบแทนคาดหวังหรือกำไรจากตลาด</p></div>
          <div><span>เงินเหลือจริง</span><b className={financial.monthlySurplus >= 0 ? "positive" : "negative"}>{money(financial.monthlySurplus)}</b><p>{formatNumber(financial.surplusRate)}% ของรายรับ</p></div>
          <div><span>เงินสำรอง</span><b>{formatNumber(financial.runwayMonths)} เดือน</b><p>{money(ips.emergencySavings)} จากเป้าหมาย {money(financial.emergencyTarget)}</p></div>
          <div><span>หนี้คงเหลือ</span><b>{money(ips.debtBalance)}</b><p>ดอกเบี้ย {formatNumber(ips.debtApr)}% ต่อปี</p></div>
          <div><span>ลงทุนได้ไม่กดชีวิต</span><b>{money(financial.investableMonthly)}</b><p>ค่าที่ต่ำกว่าระหว่างเงินตั้งใจลงทุนกับเงินเหลือจริง</p></div>
        </div>
        <div className="priority-box">
          <b>ลำดับก่อนเพิ่มความเสี่ยง</b>
          <ol>
            <li className={financial.highInterestDebt ? "warn" : "done"}>จัดการหนี้ดอกเบี้ยสูง: {financial.highInterestDebt ? "ต้องทำก่อน" : "ไม่พบข้อจำกัดเร่งด่วน"}</li>
            <li className={financial.emergencyGap > 0 ? "warn" : "done"}>เติมเงินสำรอง: {financial.emergencyGap > 0 ? `ยังขาด ${money(financial.emergencyGap)}` : "ถึงเป้าหมายแล้ว"}</li>
            <li className={financial.investableMonthly < ips.monthly ? "warn" : "done"}>ตรวจเงินลงทุนต่อเดือน: ใช้เพดาน {money(financial.investableMonthly)}</li>
          </ol>
        </div>
        <p className="demo-note">{ips.isDemo ? "ตัวเลขทั้งหมดเป็น fixture สำหรับตรวจระบบ เมื่อส่งมอบจริงต้องมาจากโปรไฟล์การเงินฝั่ง server และมีวันที่ยืนยัน" : `ข้อมูลนี้ใช้กับเป้าหมาย “${ips.goal}” และต้องทบทวนเมื่อรายรับ หนี้ หรือภาระครอบครัวเปลี่ยน`}</p>
      </Page>

      <Page pageId="money-buckets" part="ภาค 2 · สมุดบัญชีสามกอง" cue="เงินทุกบาทต้องมีชื่อก่อนมีผลตอบแทน" title="จากทุนตั้งต้น เปลี่ยนให้เป็นสามสัญญาที่คุณทำกับตัวเอง">
        <div className="ledger">
          <div className="ledger-row">
            <b>{d.trading.split.cold}%</b><span className="amount">{money(coldAmount)}</span>
            <div><h2>กองเย็น · สร้างอนาคต</h2><p>รอได้ตามเป้าหมาย {ips.horizonYears} ปี ใช้กับพอร์ตหลักและทยอยเติมเดือนละ {money(ips.monthly)} โดยไม่ดึงออกเพราะข่าวระยะสั้น</p></div>
            <aside>กติกา: ทบทวนตามรอบ ไม่ทบทวนตามอารมณ์ตลาด</aside>
          </div>
          <div className="ledger-row">
            <b>{d.trading.split.fast}%</b><span className="amount">{money(fastAmount)}</span>
            <div><h2>กองเร็ว · เรียนรู้แบบจำกัดความเสียหาย</h2><p>ใช้ทดลองสมมติฐานหรือจังหวะสั้น ขาดทุนได้โดยไม่กระทบแผนหลัก และห้ามเติมเงินเพื่อแก้มือ</p></div>
            <aside>กติกา: หนึ่งแนวคิดต่อหนึ่งครั้ง พร้อมวันสิ้นสุด</aside>
          </div>
          <div className="ledger-row">
            <b>{d.trading.split.emergency}%</b><span className="amount">{money(emergencyAmount)}</span>
            <div><h2>กองฉุกเฉิน · ซื้อเวลาให้ชีวิต</h2><p>ค่าใช้จ่ายเป้าหมาย {ips.emergencyMonths} เดือนเท่ากับ {money(ips.monthlyExpense * ips.emergencyMonths)} จึงต้องตรวจว่ากองนี้พอจริงหรือยัง</p></div>
            <aside>กติกา: สภาพคล่องมาก่อนผลตอบแทน</aside>
          </div>
        </div>
        <p className="demo-note">สัดส่วน {d.trading.split.cold}/{d.trading.split.fast}/{d.trading.split.emergency} เป็นสมมติฐานจากรูปแบบพฤติกรรม ต้องให้เงินสำรอง หนี้ เป้าหมาย และ risk capacity ในหน้าถัดไปเป็นผู้ปรับก่อนใช้เงินจริง</p>
      </Page>

      <Page pageId="risk-capacity" part="ภาค 2 · ความเสี่ยง" cue="แยกความกล้าออกจากความสามารถ" title="ใจอยากรับความผันผวนเท่าไร และชีวิตรับความเสียหายได้เท่าไร เป็นคนละคำถาม">
        <div className="risk-columns">
          <article><span>WILLINGNESS</span><h2>{financial.willingness}</h2><b>กรอบลดลงสูงสุด {formatNumber(ips.maxDrawdown, 0)}%</b><p>สะท้อนความรู้สึกและการตอบสนองที่ผู้ใช้คาดไว้ แต่ยังไม่บอกว่าชีวิตรับผลกระทบได้จริงหรือไม่</p></article>
          <article><span>CAPACITY</span><h2>{financial.capacity}</h2><b>เงินสำรอง {formatNumber(financial.runwayMonths)} เดือน · เป้าหมาย {ips.horizonYears} ปี</b><p>คำนวณจากสภาพคล่อง ระยะเวลา เงินเหลือ และภาระหนี้ จึงต้องมาก่อนความมั่นใจส่วนตัว</p></article>
        </div>
        <div className="effective-risk">
          <span>กรอบที่ใช้จริง</span><b>{financial.effectiveRisk}</b><p>ระบบเลือกค่าที่อนุรักษ์นิยมกว่าระหว่าง willingness และ capacity เพื่อไม่ให้ความกล้าชั่วคราวกลบข้อจำกัดของชีวิต</p>
        </div>
        <div className="alert-list">
          {financial.alerts.map((alert, index) => <div key={alert}><b>{String(index + 1).padStart(2, "0")}</b><p>{alert}</p></div>)}
        </div>
      </Page>

      <Page pageId="allocation" part="ภาค 2 · พอร์ตในกองเย็น" cue="ชั้นที่สองของระบบเงิน" title="จัดสินทรัพย์เฉพาะในกองเย็น แล้วทดสอบว่าความเสียหายยังอยู่ในขอบเขตชีวิต">
        <div className="portfolio-intro">
          <div><h2>โมเดล “{selected.name}”</h2><p>{selected.reason} โมเดลนี้คำนวณจากกรอบรับการลดลงสูงสุด {formatNumber(ips.maxDrawdown, 0)}% และระยะเวลา {ips.horizonYears} ปี ไม่ได้เกิดจากธาตุเพียงอย่างเดียว</p></div>
          <div className="portfolio-badge"><span>ฐานคำนวณ</span><b>{money(coldAmount)}<br />กองเย็น</b></div>
        </div>
        <div className="allocation-bar">
          <span className="equity" style={{ width: `${selected.allocation.equity}%` }}>หุ้น {selected.allocation.equity}%</span>
          <span className="bond" style={{ width: `${selected.allocation.bond}%` }}>กันแรง {selected.allocation.bond}%</span>
          <span className="cash" style={{ width: `${selected.allocation.cash}%` }}>พร้อมใช้ {selected.allocation.cash}%</span>
        </div>
        <div className="allocation-values">
          <div><b>{money(equityAmount)}</b><span>หุ้นหรือกองทุนหุ้นที่เข้าใจธุรกิจและกระจายความเสี่ยง</span></div>
          <div><b>{money(bondAmount)}</b><span>ตราสารหนี้คุณภาพหรือสินทรัพย์ที่ลดแรงแกว่งตามข้อจำกัดจริง</span></div>
          <div><b>{money(cashAmount)}</b><span>เงินพร้อมทยอย ไม่รวมกองฉุกเฉินที่แยกไว้ก่อนแล้ว</span></div>
        </div>
        <div className="stress-test">
          <h2>ทดสอบก่อนใช้เงินจริง: ถ้าหุ้นลดลง 20%</h2>
          <div className="stress-row"><span>มูลค่าหุ้นในกองเย็น</span><i><b style={{ width: "100%" }} /></i><b>{money(equityAmount)}</b></div>
          <div className="stress-row"><span>ขาดทุนจำลอง</span><i><b style={{ width: "20%" }} /></i><b>-{money(stressLoss)}</b></div>
          <div className="stress-row"><span>ผลต่อทุนทั้งหมด</span><i><b style={{ width: `${Math.min(stressPct * 5, 100)}%` }} /></i><b>-{formatNumber(stressPct)}%</b></div>
        </div>
      </Page>

      <Page pageId="goal-gap" part="ภาค 2 · เป้าหมาย" cue="สามสมมติฐาน ไม่ใช่สามคำสัญญา" title={`เป้าหมาย “${ips.goal}” ยังต้องเติมเงินและเวลาเท่าไร`}>
        <div className="goal-hero">
          <div><span>เป้าหมาย</span><b>{money(ips.goalAmount)}</b><p>ภายใน {ips.goalYears} ปี</p></div>
          <div><span>มีแล้ว</span><b>{money(ips.currentGoalSavings)}</b><p>{formatNumber(ips.goalAmount > 0 ? ips.currentGoalSavings / ips.goalAmount * 100 : 0)}% ของเป้าหมาย</p></div>
          <div><span>ช่องว่างวันนี้</span><b>{money(financial.goalGap)}</b><p>ก่อนคิดผลตอบแทนในอนาคต</p></div>
        </div>
        <div className="goal-scenarios">
          {financial.goalScenarios.map((scenario) => (
            <div key={scenario.annualReturn}><span>{scenario.label}</span><b>{formatNumber(scenario.annualReturn, 0)}%/ปี</b><h3>{money(scenario.requiredMonthly)} ต่อเดือน</h3><p>ผลตอบแทนเป็นเพียงสมมติฐานคำนวณ ไม่ใช่การรับประกัน</p></div>
          ))}
        </div>
        <div className="goal-verdict"><b>{financial.goalStatus}</b><p>ปัจจุบันลงทุนได้ไม่เกิน {money(financial.investableMonthly)} ต่อเดือน เทียบกับกรณีฐานกลางที่ต้องใช้ {money(financial.goalScenarios[1].requiredMonthly)} ต่อเดือน</p></div>
      </Page>

      <Page pageId="ips" part="ภาค 2 · Investment Policy" cue="รัฐธรรมนูญการเงินหนึ่งหน้า" title="กติกาที่ใช้ตอนตลาดเงียบ ต้องเป็นกติกาเดียวกับตอนตลาดผันผวน">
        <div className="ips-grid">
          <article><span>วัตถุประสงค์</span><h3>{ips.goal}</h3><p>ระยะเป้าหมาย {ips.goalYears} ปี และ horizon พอร์ต {ips.horizonYears} ปี</p></article>
          <article><span>ข้อจำกัดสภาพคล่อง</span><h3>เงินสำรอง {ips.emergencyMonths} เดือน</h3><p>{financial.emergencyGap > 0 ? `ต้องเติมอีก ${money(financial.emergencyGap)} ก่อนขยายความเสี่ยง` : "ถึงเป้าหมายจากข้อมูลชุดนี้"}</p></article>
          <article><span>กรอบสินทรัพย์</span><h3>หุ้น {selected.allocation.equity}% · กันแรง {selected.allocation.bond}% · พร้อมใช้ {selected.allocation.cash}%</h3><p>เป็นกรอบในกองลงทุน ไม่รวมเงินฉุกเฉิน</p></article>
          <article><span>เพดานความเสียหาย</span><h3>{formatNumber(ips.maxDrawdown, 0)}% ที่ผู้ใช้ระบุ</h3><p>หาก capacity ต่ำกว่า ให้ใช้ capacity เป็นข้อจำกัดสูงสุด</p></article>
          <article><span>กฎปรับสมดุล</span><h3>ทบทวนรายไตรมาสหรือ drift ≥10 จุด</h3><p>ไม่ rebalance เพียงเพราะข่าวหรือราคาหนึ่งวัน</p></article>
          <article><span>Stop condition</span><h3>ฐานชีวิตหรือ thesis เปลี่ยน</h3><p>รายรับหาย เงินสำรองต่ำกว่า 3 เดือน หนี้ดอกเบี้ยสูง หรือเหตุผลธุรกิจไม่จริง</p></article>
        </div>
        <div className="ips-sign"><span>วันที่จัดทำ {formatThaiDate(d.generatedAt)}</span><span>ทบทวนครั้งถัดไปภายใน 90 วัน</span><span>สถานะข้อมูล: {financial.confidence}</span></div>
      </Page>

      <Page pageId="current-phase" part="ภาค 2 · จังหวะปัจจุบัน" cue="วัยจรใช้กำหนดขนาด ไม่ใช้ทายราคา" title={`อายุ ${derived.age ?? "-"}: จังหวะ “${currentPhase.label}” หมายถึงทำให้การตัดสินใจย้อนกลับได้`}>
        <div className="phase-portrait">
          <div className="phase-age"><div><span>อายุปัจจุบัน</span><b>{derived.age ?? "-"}</b><span>ช่วง {displayRange(derived.currentPhase?.ageRange)} ปี</span></div></div>
          <div className="phase-copy"><span>{currentPhase.label.toUpperCase()}</span><h2>{currentPhase.action}</h2><p>{shorten(derived.currentPhase?.advice, 240)}</p></div>
        </div>
        <div className="phase-decisions">
          <div className="phase-decision"><b>เรื่องงาน</b><p>เลือกโครงการที่เพิ่มทักษะหรือกระแสเงินสดโดยไม่ผูกต้นทุนคงที่เกินจำเป็น</p><span>ทดลองก่อนขยาย</span></div>
          <div className="phase-decision"><b>เรื่องเงิน</b><p>เติมฐานสำรองและกองเย็นตามรอบ ลดการใช้เงินก้อนเพื่อไล่ตามผลตอบแทน</p><span>แบ่งไม้และมีเพดาน</span></div>
          <div className="phase-decision"><b>เรื่องการลงทุน</b><p>ใช้ตำแหน่งเล็กเพื่อเรียนรู้ ถ้าเหตุผลถูกค่อยเพิ่มตามเงื่อนไข ไม่เพิ่มเพียงเพราะราคาลง</p><span>หลักฐานก่อนน้ำหนัก</span></div>
          <div className="phase-decision"><b>เรื่องที่ควรเลื่อน</b><p>ภาระหนี้หรือข้อตกลงที่ย้อนกลับยากและตั้งอยู่บนสมมติฐานรายได้ดีที่สุด</p><span>เผื่อทางถอย</span></div>
        </div>
      </Page>

      <Page pageId="life-map" part="ภาค 2 · แผนที่ชีวิต" cue="ย่อช่วงย่อยให้เห็นจังหวะใหญ่" title="ชีวิตไม่ได้มีช่วงทองเพียงครั้งเดียว แต่มีช่วงที่หน้าที่ของเงินเปลี่ยนไป">
        <div className="life-groups">
          {derived.lifeBands.map((band) => (
            <div className={`life-group ${band.active ? "active" : ""}`} key={band.range} style={{ "--phase-color": band.meta.color } as CSSProperties}>
              <b>{band.range}</b>
              <span>{band.meta.label}</span>
              <div><h3>{band.meta.action}</h3><p>{band.details}</p></div>
            </div>
          ))}
        </div>
        <div className="editorial-callout"><b>วิธีใช้หน้ากระดาษนี้</b><p>ดูแถวที่มีพื้นสีเป็น “บทบาทของเงิน” ในช่วงปัจจุบัน แล้วอ่านช่วงย่อยด้านล่างของแถวนั้น อย่าเปลี่ยนพอร์ตทั้งก้อนเพราะคำเดียว เช่น ขยายหรือตั้งรับ</p></div>
      </Page>

      <Page pageId="month-plan" part="ภาค 2 · เดือนนี้" cue="แปลงสัญญาณรายเดือนเป็นแผนสี่สัปดาห์" title={`เดือนธาตุ${d.monthAdvice.element || "-"}: ทำทีละขั้นแทนการตอบสนองต่อทุกสัญญาณ`}>
        <div className="month-banner">
          <div className="month-element">{d.monthAdvice.element || "-"}</div>
          <div><h2>{monthFitLabel(d.monthAdvice.fit)}</h2><p>{monthNarrative(d.monthAdvice.element, d.monthAdvice.fit)}</p></div>
        </div>
        <div className="week-plan">
          {[
            ["สัปดาห์ 1", "จัดฐาน", "อัปเดตเงินสามกอง เช็กเงินฉุกเฉิน และปิดรายการที่ไม่มีหน้าที่ชัด"],
            ["สัปดาห์ 2", "อ่านธุรกิจ", "เลือกไม่เกิน 2 บริษัทจากคิวงานวิจัย แล้วสรุปว่ารายได้มาจากไหนในหนึ่งย่อหน้า"],
            ["สัปดาห์ 3", "ทดสอบราคา", "เปรียบเทียบมูลค่ากับอดีตและคู่แข่ง เขียนกรณีดี กลาง แย่ โดยยังไม่ต้องตัดสินใจ"],
            ["สัปดาห์ 4", "ปิดคำตอบ", `เลือกหนึ่งอย่าง: ผ่าน / รอดู / ตัดออก และกำหนดวันทบทวนครั้งถัดไปตามจังหวะ ${currentPhase.label}`],
          ].map(([week, title, text]) => (
            <div className="week-row" key={week}><b>{week}</b><h3>{title}</h3><p>{text}</p></div>
          ))}
        </div>
        <div className="day-pair">
          <div><b>วันเหมาะกับงานที่ต้องการความนิ่ง</b><span>{goodDays}</span></div>
          <div><b>วันเตือนให้ลดขนาดหรือเลื่อนคำตอบ</b><span>{avoidDays}</span></div>
        </div>
      </Page>

      <Page pageId="research-funnel" part="ภาค 3 · กระบวนการคัด" cue="ดวงอยู่ต้นกรวย ไม่ใช่ปลายกรวย" title="ห้าด่านที่เปลี่ยนคำว่า “ถูกธาตุ” ให้เป็นการตัดสินใจที่ตรวจสอบได้">
        <div className="funnel">
          {[
            ["01", "คำตอบจากดวง", `${d.strengthen.element} เป็นธีมที่ช่วยถ่วงสมดุล จึงใช้ค้นหากลุ่มธุรกิจเพื่อศึกษา ไม่ใช่คาดการณ์ผลตอบแทน`],
            ["02", "เหตุผลทางธุรกิจ", "อธิบายให้ได้ว่าบริษัทหาเงินจากใคร อะไรทำให้ลูกค้ากลับมา และต้นทุนใดควบคุมไม่ได้"],
            ["03", "หลักฐานจากงบ", "ตรวจการเติบโต กำไร กระแสเงินสด หนี้ และผลตอบแทนต่อทุนอย่างน้อย 3-5 ปี"],
            ["04", "ราคาและความคาดหวัง", "กิจการดีอาจเป็นการลงทุนไม่ดีเมื่อราคาต้องการอนาคตที่สมบูรณ์แบบเกินไป"],
            ["05", "การกระทำและทางถอย", "กำหนดขนาดเริ่มต้น เหตุผลเพิ่มน้ำหนัก เงื่อนไขหยุด และวันที่ทบทวนก่อนส่งคำสั่ง"],
          ].map(([no, title, text]) => (
            <div className="funnel-row" key={no}><b>{no}</b><h2>{title}</h2><p>{text}</p></div>
          ))}
        </div>
        <div className="funnel-result">บริษัทที่ผ่านครบห้าด่านจึงเป็น “ผู้สมัครเข้าพอร์ต” ไม่ใช่หุ้นที่ต้องซื้อ</div>
      </Page>

      <Page pageId="company-duo" part="ภาค 3 · กรณีศึกษา 1" cue="ธุรกิจคล้ายกัน แต่โจทย์ที่ต้องตอบไม่เหมือนกัน" title={`${bh.ticker} กับ ${bdms.ticker}: ธีมใกล้กัน แต่คุณภาพที่ต้องพิสูจน์อยู่คนละจุด`}>
        <p className="duo-intro">ทั้งสองบริษัทอยู่ในธีมที่เชื่อมกับ {d.strengthen.element} ตามฐานข้อมูลรอบ {marketDate} หน้านี้สาธิตวิธีอ่าน ไม่ใช่จัดอันดับผู้ชนะ</p>
        <div className="company-duo">
          {[bh, bdms].map((pick, index) => (
            <article key={`${pick.ticker}-${index}`}>
              <div className="ticker"><b>{pick.ticker}</b><span>{formatNumber(pick.score)} / 10</span></div>
              <h2>{pick.name}</h2>
              <p>{shorten(pick.business, 190)}</p>
              <MetricLine pick={pick} />
              <h3>สิ่งที่ต้องพิสูจน์</h3>
              <ul>
                <li>{index === 0 ? `ตัวขับรายได้หลักของ ${pick.ticker} ยั่งยืนและแปลงเป็นเงินสดได้หรือไม่` : `ขนาดและความหลากหลายของ ${pick.ticker} ลดความเสี่ยงหรือเพิ่มความซับซ้อนเพียงใด`}</li>
                <li>การเติบโตมาจากปริมาณ ราคา หรือรายการที่เกิดครั้งเดียว</li>
                <li>มูลค่าปัจจุบันเหลือส่วนเผื่อความผิดพลาดมากพอหรือยัง</li>
              </ul>
            </article>
          ))}
        </div>
        <p className="comparison-close">คำถามตัดสิน: ตัวขับกำไรของสองบริษัทต่างกันจริงหรือเพียงใช้ชื่อคนละชื่อกับความเสี่ยงก้อนเดียว และราคาปัจจุบันเหลือส่วนเผื่อเมื่อเรื่องราวไม่เป็นไปตามคาดหรือไม่</p>
      </Page>

      <Page pageId="company-trio" part="ภาค 3 · Deep research" cue="สามบริษัทต้องมีสามกลไกกำไร ไม่ใช่สามชื่อในธีมเดียว" title={`${energyRows.map((pick) => pick.ticker).join(", ")}: เปรียบเทียบตัวขับกำไรก่อนคิดว่าเป็นการกระจาย`}>
        <div className="energy-list">
          {energyRows.map((pick, index) => {
            const lens = [
              { title: "ราคาสินค้าโภคภัณฑ์", question: "กำไรเปลี่ยนอย่างไรเมื่อราคาพลังงานและต้นทุนสำรวจไม่เป็นใจ" },
              { title: "สัญญาและโครงสร้างทุน", question: "การเติบโตใหม่ให้ผลตอบแทนสูงกว่าต้นทุนเงินทุนและภาระหนี้หรือไม่" },
              { title: "วัฏจักรและการเปลี่ยนผ่าน", question: "ธุรกิจเดิมสร้างเงินสดพอรองรับการลงทุนใหม่โดยไม่เพิ่มความเสี่ยงเกินไปหรือไม่" },
            ][index];
            return (
              <div className="energy-row" key={`${pick.ticker}-${index}`}>
                <b>{pick.ticker}</b>
                <div><h2>{pick.name}</h2><p>{shorten(pick.business, 170)}</p></div>
                <aside><b>{lens.title}</b>{lens.question}</aside>
              </div>
            );
          })}
        </div>
        <div className="editorial-callout"><b>หลักคิด</b><p>อย่ากระจายด้วยการซื้อสามชื่อในธีมเดียวแล้วคิดว่าความเสี่ยงแยกจากกัน ให้ระบุ “ตัวขับกำไร” ของแต่ละบริษัทก่อน หากตัวขับเดียวกันล้มพร้อมกัน นั่นยังเป็นความเสี่ยงก้อนเดียว</p></div>
      </Page>

      <Page pageId="research-queue" part="ภาค 3 · รายการศึกษา" cue={`ข้อมูลตลาด ณ ${marketDate}`} title="ห้าบริษัทนี้คือคิวงานวิจัย ไม่ใช่ใบสั่งซื้อ">
        <div className="watchlist">
          {(derived.picks.length ? derived.picks : [FALLBACK_PICK]).map((pick, index) => (
            <div className="watch-row" key={`${pick.ticker}-${index}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <h2>{pick.ticker}</h2>
              <div><h3>{pick.name} · ธาตุ{pick.element}</h3><p>{researchLens(pick)}</p></div>
              <aside>{formatNumber(pick.score)} / 10<br />{pickSignal(pick)}</aside>
            </div>
          ))}
        </div>
        <p className="trust-note"><strong>คะแนนทำหน้าที่จัดคิว ไม่ได้วัดโอกาสกำไร</strong> หากข้อมูลงบไม่ครบ ราคาล้าสมัย หรือคำอธิบายธุรกิจตรวจสอบไม่ได้ ให้หยุดที่ “รอข้อมูล” ไม่ควรเติมช่องว่างด้วยความเชื่อเรื่องดวง</p>
      </Page>

      <Page pageId="portfolio-diagnostic" part="ภาค 3 · วินิจฉัยพอร์ต" cue={ips.isDemo ? "DEMO ALLOCATION" : "สัดส่วนที่ผู้ใช้ระบุ"} title="ก่อนเพิ่มหุ้นตัวใหม่ ต้องรู้ก่อนว่าพอร์ตเดิมกำลังเดิมพันกับอะไรอยู่">
        <div className="portfolio-compare">
          <div className="portfolio-side"><span>พอร์ตปัจจุบัน</span><h2>หุ้น {financial.currentAllocation.equity}%</h2><p>กันแรง {financial.currentAllocation.bond}% · พร้อมใช้ {financial.currentAllocation.cash}%</p></div>
          <div className="portfolio-arrow">→</div>
          <div className="portfolio-side target"><span>กรอบ IPS</span><h2>หุ้น {selected.allocation.equity}%</h2><p>กันแรง {selected.allocation.bond}% · พร้อมใช้ {selected.allocation.cash}%</p></div>
        </div>
        <div className="drift-list">
          {([
            ["หุ้น", financial.allocationDrift.equity],
            ["สินทรัพย์กันแรง", financial.allocationDrift.bond],
            ["เงินพร้อมใช้", financial.allocationDrift.cash],
          ] as Array<[string, number]>).map(([label, drift]) => (
            <div key={label}><span>{label}</span><i><b style={{ width: `${Math.min(100, Math.abs(drift) * 4)}%` }} /></i><strong className={Math.abs(drift) >= 10 ? "warn" : "ok"}>{drift > 0 ? "+" : ""}{drift} จุด</strong></div>
          ))}
        </div>
        <div className="portfolio-questions">
          <article><b>01</b><h3>Concentration</h3><p>สินทรัพย์หรือธีมใดเกิน 20% และจะเสียพร้อมกันเมื่อสมมติฐานเดียวผิดหรือไม่</p></article>
          <article><b>02</b><h3>Liquidity</h3><p>เงินที่ต้องใช้ใน 3 ปีถูกวางไว้ในสินทรัพย์ที่ลดลงแรงหรือขายยากหรือไม่</p></article>
          <article><b>03</b><h3>Role</h3><p>ทุกสถานะมีหน้าที่ชัดหรือมีบางตัวอยู่เพียงเพราะยังไม่อยากยอมรับว่าต้องตัดสินใจ</p></article>
          <article><b>04</b><h3>Rebalance</h3><p>ปรับเมื่อ drift เกินกฎ IPS ไม่ปรับเพียงเพราะสินทรัพย์หนึ่งกำลังเป็นข่าว</p></article>
        </div>
      </Page>

      <Page pageId="scenario-lab" part="ภาค 3 · Scenario Laboratory" cue="เห็นความเสียหายก่อนเห็นผลตอบแทน" title="ถ้าตลาดหรือรายรับผิดจากแผน คุณต้องรู้ล่วงหน้าว่าจะทำอะไร">
        <div className="scenario-list">
          {financial.stressScenarios.map((scenario) => (
            <div className="scenario-row" key={scenario.marketDrop}>
              <b>-{scenario.marketDrop}%</b>
              <div><h3>{scenario.label}</h3><p>{scenario.action}</p></div>
              <aside><span>ขาดทุนจำลอง</span><strong>-{money(scenario.estimatedLoss)}</strong><small>ทุนหลังเหตุการณ์ {money(scenario.postStressCapital)}</small></aside>
            </div>
          ))}
        </div>
        <div className="income-shock">
          {financial.incomeShock.map((shock) => (
            <article key={shock.months}><span>รายได้หาย {shock.months} เดือน</span><b>{shock.remainingEmergency >= 0 ? money(shock.remainingEmergency) : `-${money(Math.abs(shock.remainingEmergency))}`}</b><p>{shock.status}</p></article>
          ))}
        </div>
        <div className="editorial-callout"><b>กฎก่อนเหตุการณ์จริง</b><p>หากเงินสำรองต่ำกว่า 3 เดือน หนี้ดอกเบี้ยสูง หรือรายรับหลักหาย ให้หยุดเพิ่มความเสี่ยงก่อนพิจารณาว่าราคาหุ้นน่าสนใจเพียงใด</p></div>
      </Page>

      <Page pageId="worksheet" part="ภาค 3 · แบบคัดก่อนลงทุน" cue="พิมพ์หน้านี้แยกได้" title="หนึ่งบริษัท หนึ่งสมมติฐาน หนึ่งทางถอย">
        <div className="worksheet-meta">
          <div><span>บริษัท / สินทรัพย์</span><p>...........................................................................................................</p></div>
          <div><span>วันที่ทบทวน</span><p>.................................</p></div>
        </div>
        <div className="worksheet">
          {[
            ["01", "ฉันเข้าใจรายได้หรือยัง", "เขียนว่าลูกค้าคือใคร บริษัทแก้ปัญหาอะไร และเงินเข้าจากช่องทางใด"],
            ["02", "หลักฐานสามข้อ", "ใช้ตัวเลขงบหรือข้อมูลอุตสาหกรรม ไม่ใช้เพียงคำว่าแบรนด์ดีหรืออนาคตดี"],
            ["03", "ความคาดหวังในราคา", "ราคานี้ต้องการการเติบโตแบบใด และมีส่วนเผื่อเมื่อสมมติฐานผิดแค่ไหน"],
            ["04", "กรณีที่ฉันคิดผิด", "ข้อมูลอะไรจะหักล้างเหตุผลหลัก และฉันจะยอมรับได้เร็วเพียงใด"],
            ["05", "ขนาดและวันสิ้นสุด", "เริ่มกี่บาท เพิ่มเมื่ออะไรเกิด หยุดเมื่ออะไรเกิด และทบทวนวันใด"],
          ].map(([no, title, hint]) => (
            <article key={no}>
              <b>{no}</b>
              <div><h3>{title}</h3><small>{hint}</small><div className="write-lines">...................................................................................................................................................................</div></div>
            </article>
          ))}
        </div>
      </Page>

      <Page pageId="action-plan" part="ภาค 3 · แผนลงมือทำ" cue="จากคำอ่านสู่ระบบที่วัดผลได้" title={`แผน 30/90/365 วัน: สร้าง${supportElement}ให้กระบวนการก่อนเพิ่มเงินให้พอร์ต`}>
        <div className="action-timeline">
          <div className="action-stage">
            <header><b>วัน 1-7</b><h2>ตั้งฐานและลดเสียงรบกวน</h2></header>
            <ul><li>แยกเงินสามกองตามหน้าสถาปัตยกรรมเงิน</li><li>ตรวจช่องว่างกองฉุกเฉิน</li><li>จำกัดรายการศึกษาที่ 5 บริษัท</li><li>เลือกวันทบทวนประจำเดือน</li></ul>
          </div>
          <div className="action-stage">
            <header><b>วัน 8-30</b><h2>สร้างหลักฐานก่อนสร้างสถานะ</h2></header>
            <ul><li>ทำแบบคัดให้ครบ 2 บริษัท</li><li>อ่านงบย้อนหลังและคู่แข่ง</li><li>เขียนกรณีดี กลาง แย่</li><li>ทดลองเฉพาะในกองเร็วถ้าจำเป็น</li></ul>
          </div>
          <div className="action-stage">
            <header><b>วัน 31-90</b><h2>ทบทวนพฤติกรรม ไม่ไล่ตามผลตอบแทน</h2></header>
            <ul><li>นับครั้งที่ตัดสินใจนอกกติกา</li><li>ดูว่าขนาดขาดทุนอยู่ในกรอบหรือไม่</li><li>ตัดรายชื่อที่อธิบายไม่ได้</li><li>เพิ่มเงินเมื่อระบบนิ่ง ไม่ใช่เมื่อมั่นใจที่สุด</li></ul>
          </div>
        </div>
        <div className="editorial-callout"><b>ตัวชี้วัดที่สำคัญกว่า “ชนะตลาด” ใน 90 วัน</b><p>จำนวนครั้งที่คุณเขียนเหตุผลก่อนซื้อ, จำนวนการตัดสินใจที่อยู่ในเพดาน, และจำนวนครั้งที่ยอม “ไม่ทำอะไร” เมื่อหลักฐานไม่พอ</p></div>
      </Page>

      <Page pageId="decision-journal" part="ภาค 4 · Decision Journal" cue="บันทึกก่อนรู้ผล เพื่อไม่ให้ความจำแก้เหตุผลย้อนหลัง" title="คุณภาพการตัดสินใจวัดจากกระบวนการ ไม่ได้วัดจากผลลัพธ์ครั้งเดียว">
        <div className="journal-sheet">
          <article><span>การตัดสินใจ</span><p>............................................................................................................................</p></article>
          <article><span>เหตุผลหลัก 3 ข้อ</span><p>1. .........................................................................................................................<br />2. .........................................................................................................................<br />3. .........................................................................................................................</p></article>
          <article><span>ข้อมูลที่จะทำให้เปลี่ยนใจ</span><p>............................................................................................................................</p></article>
          <article><span>ขนาด / เพดานเสียหาย / วันทบทวน</span><p>............................................................................................................................</p></article>
        </div>
        <div className="journal-score">
          {["ข้อมูลครบตามเกณฑ์", "ขนาดอยู่ใน IPS", "ไม่มีแรงเร่งจากราคา", "อธิบายทางถอยได้", "กำหนดวันทบทวนแล้ว"].map((label) => <div key={label}><span>□</span><b>{label}</b></div>)}
        </div>
        <div className="editorial-callout"><b>ทบทวนหลัง 30 วัน</b><p>ให้คะแนนกระบวนการก่อนดูว่ากำไรหรือขาดทุน การตัดสินใจที่ดีอาจขาดทุนได้ และการตัดสินใจที่แย่อาจบังเอิญกำไรได้</p></div>
      </Page>

      <Page pageId="monthly-baseline" part="ภาค 4 · Monthly Baseline" cue="จุดเริ่มสำหรับเปรียบเทียบฉบับถัดไป" title="รอบหน้าไม่ควรเขียนหนังสือเดิมใหม่ แต่ต้องบอกว่าสิ่งใดเปลี่ยนและทำไม">
        <div className="baseline-grid">
          <article><span>เงินสำรอง</span><b>{formatNumber(financial.runwayMonths)} เดือน</b><p>เป้าหมาย {ips.emergencyMonths} เดือน</p></article>
          <article><span>เงินลงทุนต่อเดือน</span><b>{money(financial.investableMonthly)}</b><p>เทียบเงินตั้งใจ {money(ips.monthly)}</p></article>
          <article><span>ช่องว่างเป้าหมาย</span><b>{money(financial.goalGap)}</b><p>สถานะ {financial.goalStatus}</p></article>
          <article><span>Risk frame</span><b>{financial.effectiveRisk}</b><p>Willingness {financial.willingness} · Capacity {financial.capacity}</p></article>
          <article><span>พอร์ตหุ้น</span><b>{financial.currentAllocation.equity}%</b><p>กรอบ IPS {selected.allocation.equity}%</p></article>
          <article><span>คิววิจัย</span><b>{derived.picks.length} บริษัท</b><p>{derived.picks.map((pick) => pick.ticker).join(" · ") || "รอข้อมูล"}</p></article>
        </div>
        <div className="delta-contract"><b>ฉบับถัดไปต้องรายงาน</b><span>ค่าเดิม</span><span>ค่าใหม่</span><span>สาเหตุ</span><span>ผลต่อแผน</span><span>งานที่ต้องทำ</span></div>
        <p className="demo-note">Baseline ID: {`${d.profile?.birthDate || "unknown"}-${manifest.version}-${d.generatedAt}`} · สร้างจากข้อมูล ณ {marketDate}</p>
      </Page>

      <Page pageId="annual-roadmap" part="ภาค 4 · 12-Month Review" cue="สี่รอบใหญ่ แทนการปรับพอร์ตทุกสัปดาห์" title="แผนหนึ่งปีต้องวัดฐานชีวิต พอร์ต และพฤติกรรมพร้อมกัน">
        <div className="quarter-roadmap">
          <article><b>Q1</b><h3>ซ่อมฐานและยืนยันข้อมูล</h3><p>เติมเงินสำรอง ตรวจหนี้ ยืนยัน holdings และเขียน IPS ให้ครบ</p><span>ตัวชี้วัด: runway / debt APR / data completeness</span></article>
          <article><b>Q2</b><h3>ทดสอบกระบวนการ</h3><p>ทำ dossier สองบริษัท ใช้ decision journal และวัดจำนวนครั้งที่หลุดกติกา</p><span>ตัวชี้วัด: process adherence / research completed</span></article>
          <article><b>Q3</b><h3>ตรวจพอร์ตทั้งก้อน</h3><p>ดู concentration, currency, fees, thesis และ drift จาก IPS</p><span>ตัวชี้วัด: max position / drift / fee drag</span></article>
          <article><b>Q4</b><h3>ทบทวนเป้าหมาย</h3><p>อัปเดตรายรับ ภาระ เป้าหมาย และตัดสิ่งที่ไม่มีหน้าที่ออกจากพอร์ต</p><span>ตัวชี้วัด: goal gap / contribution / decisions retired</span></article>
        </div>
      </Page>

      <Page pageId="source-ledger" part="ภาคผนวก · Evidence Ledger" cue={`ข้อมูลตลาด ณ ${marketDate}`} title="ตัวเลขและคำแนะนำทุกชิ้นต้องย้อนกลับไปหาข้อมูลต้นทางได้">
        <div className="source-ledger">
          <div className="source-head"><b>รายการ</b><b>ต้นทาง</b><b>สถานะ/วันที่</b></div>
          <div><span>วัน เวลา และสถานที่เกิด</span><p>ข้อมูลที่ผู้ใช้ระบุในโปรไฟล์</p><small>{birthLabel}</small></div>
          <div><span>ฐานะ เป้าหมาย และความเสี่ยง</span><p>{ips.isDemo ? "Financial fixture สำหรับ QA" : "ข้อมูลที่ผู้ใช้ระบุ"}</p><small>{financial.confidence} · {formatThaiDate(d.generatedAt)}</small></div>
          <div><span>BaZi persona และสมดุลธาตุ</span><p>Deterministic symbolic engine</p><small>{d.persona.bandLabel} · ธาตุเด่น{dominantElement.element}</small></div>
          {derived.picks.slice(0, 5).map((pick) => (
            <div key={pick.ticker}><span>{pick.ticker} · {pick.name}</span><p>{pick.evidence?.businessSource || pick.evidence?.elementSource || "ฐานข้อมูลธุรกิจและตลาดภายใน"}</p><small>{pick.evidence?.reviewStatus || "รอตรวจ"} · {marketDate}</small></div>
          ))}
        </div>
        <div className="editorial-callout"><b>Freshness policy</b><p>หากข้อมูลราคา งบ หรือคำอธิบายธุรกิจเกินรอบที่กำหนด ต้องแสดงคำว่า stale และหยุดข้อสรุปเชิงกิจการไว้ที่ “รอข้อมูล”</p></div>
      </Page>

      <Page pageId="closing" className="closing">
        <div className="closing-copy">
          <span>FINAL NOTE</span>
          <h1>คุณไม่ต้องทำนายอนาคตให้ถูก<br />เพื่อดูแลเงินได้ดี</h1>
          <p>สำหรับดวง {d.persona.name} ความได้เปรียบเกิดขึ้นเมื่อคุณใช้จุดแข็งของธาตุ{dominantElement.element}ร่วมกับนิสัยธาตุ{supportElement}: {supportBehavior.habit}</p>
        </div>
        <div className="method-box">
          <b>วิธีและข้อจำกัด</b>
          <span>เล่มนี้ผสานผลคำนวณ Bazi จากวัน เวลา และสถานที่เกิด กับกรอบวางแผนการเงินและข้อมูลบริษัท ณ {marketDate} การตีความใช้เพื่อสะท้อนรูปแบบการตัดสินใจ ไม่ใช่การรับรองผลตอบแทน ข้อมูลตลาดอาจเปลี่ยนแปลงและควรตรวจจากแหล่งทางการก่อนตัดสินใจทุกครั้ง · สร้างเล่ม {formatThaiDate(d.generatedAt)} · {shorten(d.disclaimer, 220)}</span>
        </div>
      </Page>
      </ReportManifestContext.Provider>
    </main>
  );
}
