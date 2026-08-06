/**
 * CHAT DEMO — CLI ถาม-ตอบ (Phase 1.4) ยังไม่ใช้ LLM — ตอบจาก tools + template
 *
 * รัน: npx tsx scripts/chat-demo.ts --birth 1990-05-15 --time 14:30 --gender female --user demo1
 *   (ไม่ใส่ --birth → บอทจะถามวันเกิดก่อน)
 * ทดสอบอัตโนมัติ: echo "หุ้นวันนี้" | npx tsx scripts/chat-demo.ts --birth ... --user demo1
 */
import { createInterface } from "node:readline";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { detectIntent } from "../src/lib/chat/intents";
import { getTodayMovers, getUpcomingIPOs, getBaziVerdict, getFundamentals, getNewsImpact, generateReport, getTodayAlmanac, getFortuneInvest } from "../src/lib/chat/tools";
import { upsertUser, loadUser, isChartStale } from "../src/lib/chat/user-store";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DISCLAIMER = "⚠️ แนวโน้มตามดวง + ข้อมูล (ไม่ใช่คำแนะนำการลงทุน)";

function fmtNum(n: number | undefined, digits = 2): string {
  return typeof n === "number" ? n.toFixed(digits) : "-";
}

const ICONS: Record<string, string> = { "very-good": "✅✅", good: "✅", neutral: "🟡", avoid: "⛔" };

function answer(intent: ReturnType<typeof detectIntent>, state: Awaited<ReturnType<typeof calculateBaziChart>>): string {
  switch (intent.intent) {
    case "today_movers": {
      const r = getTodayMovers({ market: intent.market, limit: 5 });
      if (!r.ok || !r.data?.length) return `ยังไม่มีข้อมูลราคาวันนี้ ${DISCLAIMER}`;
      const lines = r.data.slice(0, 5).map((m, i) => `${i + 1}. ${m.ticker} (${m.name}) ${(m.changePct ?? 0) >= 0 ? "+" : ""}${m.changePct ?? 0}% · ธาตุ${m.element}`);
      return `📈 หุ้นเด่นวันนี้:\n${lines.join("\n")}\n${DISCLAIMER}`;
    }
    case "upcoming_ipo": {
      const r = getUpcomingIPOs({ market: intent.market, limit: 5 });
      if (!r.ok || !r.data?.length) return `ยังไม่มี IPO ใหม่ ${DISCLAIMER}`;
      const lines = r.data!.map((e, i) => `${i + 1}. ${e.ticker} ${e.name} — เข้าเทรด ${e.ipoDate} (${e.exchange})`);
      return `🚀 IPO กำลังจะเข้าเทรด:\n${lines.join("\n")}\n${DISCLAIMER}`;
    }
    case "stock_verdict": {
      if (!intent.ticker) return `อยากรู้หุ้นตัวไหนคะ? ${DISCLAIMER}`;
      const r = getBaziVerdict(intent.ticker, state);
      if (!r.ok || !r.data) return r.error ?? "ไม่พบข้อมูล";
      const d = r.data as { stock: { name: string; element: string }; score: { verdict: string; score: number }; invest: string[]; avoid: string[] };
      return `${ICONS[d.score.verdict] ?? "🟡"} ${d.stock.name} (ธาตุ${d.stock.element}) กับดวงคุณ: ${d.score.verdict} (คะแนน ${d.score.score})\nธาตุที่ดวงต้องการ: ${d.invest.join(", ")} · เลี่ยง: ${d.avoid.join(", ")}\n${DISCLAIMER}`;
    }
    case "stock_analysis": {
      if (!intent.ticker) return `อยากให้วิเคราะห์หุ้นตัวไหนคะ? ${DISCLAIMER}`;
      const r = getFundamentals(intent.ticker);
      if (!r.ok || !r.data) return r.error ?? "ไม่พบข้อมูล";
      if (!r.data.hasData) return `ยังไม่มีข้อมูลพื้นฐานของ ${intent.ticker} (รอ pipeline เติม) ${DISCLAIMER}`;
      const f = r.data.fundamentals!;
      return `📊 ${intent.ticker}: ROE ${fmtNum(f.roe)}% · กำไรสุทธิ ${fmtNum(f.profitMargin)}% · โต ${fmtNum(f.revenueGrowth)}% · Buffett score ${r.data.buffettScore}/10\n${DISCLAIMER}`;
    }
    case "news_impact": {
      const r = getNewsImpact({ query: intent.matched[0], market: intent.market, limit: 3 });
      if (!r.ok || !r.data?.length) return `ยังไม่มีข่าวที่เกี่ยวข้อง ${DISCLAIMER}`;
      const lines = r.data.map((n, i) => `${i + 1}. [${n.source}] ${n.title}${n.elements?.length ? ` (ธาตุ: ${n.elements.join("/")})` : ""}`);
      return `📰 ข่าวที่เกี่ยวข้อง:\n${lines.join("\n")}\n${DISCLAIMER}`;
    }
    case "report": {
      const ticker = intent.ticker ?? "KBANK";
      const r = generateReport(ticker, state);
      if (!r.ok) return r.error ?? "ไม่พบข้อมูล";
      const d = r.data as { stock: { name: string }; verdict: { score: { verdict: string } } | null; buffett: { score: number } | null };
      return `📑 รายงานย่อ ${d.stock.name}: ${d.verdict ? `ดวง: ${d.verdict.score.verdict} · ` : ""}Buffett ${d.buffett ? `${d.buffett.score}/10` : "ยังไม่มีข้อมูล"}\n(ฉบับเต็ม Phase 3) ${DISCLAIMER}`;
    }
    case "daily_fortune": {
      const r = getTodayAlmanac();
      if (!r.ok || !r.data) return `ยังไม่มีข้อมูลปฏิทินวันนี้ ${DISCLAIMER}`;
      const d = r.data as { weekday: string; jianchu: { name: string; meaning: string } | null; colors: Array<{ element: string; colors: string }>; luckyDirection: string; luckyHours: Array<{ code: string; range: string }>; thaiLunar: { phase: string }; specialDays: string[] };
      const colors = d.colors.map((c) => `${c.element}→${c.colors}`).join(" · ");
      const hours = d.luckyHours.slice(0, 3).map((h) => h.range).join(", ");
      const specials = d.specialDays.length ? `\n📌 วันสำคัญ: ${d.specialDays.join(", ")}` : "";
      return `🗓️ วัน${d.weekday}${d.jianchu ? ` (${d.jianchu.name} — ${d.jianchu.meaning})` : ""} · ${d.thaiLunar.phase}\n🎨 สีมงคล: ${colors}\n🧭 ทิศมงคล: ${d.luckyDirection}\n⏰ ยามดี: ${hours}${specials}\n${DISCLAIMER}`;
    }
    case "fortune_invest": {
      const lower = intent.matched.join(" ");
      const scope = lower.includes("เดือน") ? "month" : lower.includes("สัปดาห์") ? "week" : "day";
      const asset = lower.includes("ที่ดิน") ? "land" : scope === "week" ? "ipo" : undefined;
      const r = getFortuneInvest({ scope, asset }, state);
      if (!r.ok || !r.data) return r.error ?? "ยังไม่มีข้อมูล";
      const d = r.data as { scope: string; dayElement?: string; favorElements?: string[]; stocks?: Array<{ ticker: string; changePct: number | null }>; monthElement?: string; caishenDir?: string; goodDays?: Array<{ date: string; weekday: string }>; luckyLandDays?: Array<{ date: string; weekday: string }>; ipo?: { entries: Array<{ ticker: string; name: string; fit: string }> } };
      if (d.scope === "month") {
        const days = (d.luckyLandDays ?? d.goodDays ?? []).slice(0, 4).map((x) => `${x.date} (${x.weekday})`).join(", ");
        return `🗓️ เดือนนี้ ธาตุเดือน: ${d.monthElement} · ทิศเงินเข้า: ${d.caishenDir}\n📅 วันดี: ${days || "ไม่มีข้อมูล"}\n${DISCLAIMER}`;
      }
      if (d.scope === "week") {
        const list = (d.ipo?.entries ?? []).slice(0, 4).map((e) => `${e.ticker} ${e.name} — ${e.fit}`).join("\n");
        return `🚀 IPO สัปดาห์นี้ (เทียบดวง):\n${list || "ไม่มี IPO ในช่วงนี้"}\n${DISCLAIMER}`;
      }
      const stocks = (d.stocks ?? []).slice(0, 4).map((s) => `${s.ticker} (${s.changePct ?? 0}%)`).join(", ");
      return `🔮 วันนี้ธาตุ: ${d.dayElement} · ธาตุควรทำ: ${(d.favorElements ?? []).join(", ")}\n📈 หุ้นที่ตรงธาตุวันนี้: ${stocks || "ไม่มีข้อมูล"}\n${DISCLAIMER}`;
    }
    case "advice_request":
      return `⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน\nเราให้บทวิเคราะห์เชิงข้อมูลเท่านั้น ลองถามเป็นข้อมูลได้ เช่น "วันนี้ดวงกับหุ้นอะไร" "วิเคราะห์ KBANK" หรือ "สัปดาห์นี้ IPO ตัวไหนเหมาะกับดวง"`;
    default: {
      return `🙏 สวัสดีครับ/ค่ะ ฉันเป็นผู้ช่วยการลงทุนคู่ดวง ลองถามได้เลย เช่น\n  • "หุ้นวันนี้ตัวไหนเด่น"\n  • "วิเคราะห์ KBANK ให้หน่อย"\n  • "KBANK กับดวงเราเป็นยังไง"\n  • "ทรัมป์ประกาศภาษีมีผลยังไง"\n  • "มี IPO ใหม่ไหม"\n${DISCLAIMER}`;
    }
  }
}

async function main() {
  const userId = arg("--user") ?? "demo";
  let profile = loadUser(userId);
  const birth = arg("--birth");
  const time = arg("--time");
  const gender = (arg("--gender") ?? "female") as "male" | "female";
  const province = arg("--province") ?? "Bangkok";

  // ไม่มีโปรไฟล์หรือข้อมูลเกิดเปลี่ยน → ใช้ที่ส่งมา (ถ้าไม่มี → ถาม)
  let birthDate = birth;
  let birthTime = time;
  if (!profile && (!birthDate || !birthTime)) {
    if (!process.stdin.isTTY) {
      console.error("❌ ไม่มีโปรไฟล์ผู้ใช้ และไม่ระบุ --birth/--time (โหมด pipe ต้องระบุให้ครบ)");
      process.exit(1);
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    birthDate = await new Promise<string>((res) => rl.question("เกิดวันที่ (YYYY-MM-DD)? ", res));
    birthTime = await new Promise<string>((res) => rl.question("เวลาเกิด (HH:mm)? ", res));
    rl.close();
  }
  profile = upsertUser({ userId, birthDate: birthDate!, birthTime: birthTime!, gender, province });
  if (birth && isChartStale(profile, { birthDate: birth!, birthTime: time ?? profile.birthTime, gender, province })) {
    profile = upsertUser({ userId, birthDate: birth!, birthTime: time ?? profile.birthTime, gender, province });
  }

  const state = await calculateBaziChart(
    { birthDate: profile.birthDate, birthTime: profile.birthTime, gender: profile.gender, province: profile.province },
    createInMemoryKnowledgeRepository(),
  );
  console.log(`☯️ ผู้ใช้ ${userId} — ดวง ${profile.birthDate} ${profile.birthTime} ${profile.gender} (แคช ${profile.chartHash})\n`);

  // โหมดครั้งเดียว (pipe) — อ่าน stdin ทั้งหมด · โหมด TTY = REPL
  let stdin = "";
  if (!process.stdin.isTTY) {
    stdin = await new Promise<string>((res) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (buf += c));
      process.stdin.on("end", () => res(buf.trim()));
    });
  }
  const useLlm = arg("--llm") !== undefined;
  if (stdin) {
    for (const line of stdin.split("\n")) {
      if (!line.trim()) continue;
      const intent = detectIntent(line);
      let text: string;
      if (useLlm) {
        const { chatWithAssistant } = await import("../src/lib/chat/assistant");
        const r = await chatWithAssistant(line, state);
        text = r.usedLlm ? r.text : `[โหมด fallback — LLM ไม่ว่าง]\n${r.text}`;
      } else {
        text = answer(intent, state);
      }
      console.log(`🧑 คุณ: ${line}`);
      console.log(`🤖 บอท: ${text}\n`);
    }
    return;
  }

  // โหมด REPL
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("พิมพ์คำถาม (exit เพื่อออก):");
  rl.on("line", async (line) => {
    if (line.trim().toLowerCase() === "exit") return rl.close();
    if (useLlm) {
      const { chatWithAssistant } = await import("../src/lib/chat/assistant");
      const r = await chatWithAssistant(line, state);
      console.log(`🤖 ${r.usedLlm ? r.text : `[โหมด fallback — LLM ไม่ว่าง]\n${r.text}`}\n`);
    } else {
      const intent = detectIntent(line);
      console.log(`🤖 ${answer(intent, state)}\n`);
    }
  });
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
