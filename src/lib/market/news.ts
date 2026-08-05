/**
 * News layer — ดึงข่าวการเงินจาก RSS (ฟรี ไม่มี key) + จำแนก keywords→เซกเตอร์→ธาตุ
 *
 * Feed เริ่มต้น (พิสูจน์แล้วว่า curl ได้ — 2026-08-05):
 *   - Yahoo Finance: https://finance.yahoo.com/news/rssindex
 *   - Investing.com (Stock Market News): https://www.investing.com/rss/news_25.rss
 *   - MarketWatch Top Stories: https://feeds.content.dowjones.io/public/rss/mw_topstories
 *
 * หลัก "ไม่เดา": keyword→ธาตุ เป็นตารางชัดเจน (เพิ่มได้ผ่าน review) — LLM เอาไปวิเคราะห์ต่อในแชท
 */
import type { ThaiElement } from "../investor/stock-database";

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string; // ISO หรือ RFC822 ดิบ
  source: string;
  description?: string;
  /** จำแนกอัตโนมัติ (classifyNews) */
  keywords?: string[];
  sectors?: string[];
  elements?: ThaiElement[];
};

export const NEWS_FEEDS: Array<{ url: string; source: string }> = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
];

/** keyword → เซกเตอร์/ธาตุ (conservative — เฉพาะที่ชัด ไม่กว้างเกิน) */
const KEYWORD_MAP: Array<{ re: RegExp; sectors: string[]; element: ThaiElement }> = [
  { re: /semiconductor|chip|nvidia|tsmc|ai chip|เซมิ/i, sectors: ["Semiconductors", "Technology"], element: "ทอง" },
  { re: /gold|bullion|ทอง/i, sectors: ["Metals & Mining"], element: "ทอง" },
  { re: /oil|crude|opec|น้ำมัน/i, sectors: ["Energy"], element: "ไฟ" },
  { re: /gas|lng|ก๊าซ/i, sectors: ["Utilities", "Energy"], element: "ไฟ" },
  { re: /bank|fed|interest rate|inflation|ดอกเบี้ย/i, sectors: ["Banks", "Financials"], element: "น้ำ" },
  { re: /tariff|trump|ภาษี/i, sectors: ["Industrials", "Materials", "Consumer Discretionary"], element: "ทอง" },
  { re: /real estate|housing|อสังหา/i, sectors: ["Real Estate"], element: "ดิน" },
  { re: /agricultur|rice|farm|ข้าว|เกษตร/i, sectors: ["Food & Beverage"], element: "ไม้" },
  { re: /electric vehicle|ev|แบตเตอรี่/i, sectors: ["Automobiles & Components", "Technology"], element: "ทอง" },
  { re: /defense|weapon|อาวุธ/i, sectors: ["Aerospace & Defense"], element: "ทอง" },
];

/** จำแนกข่าว: keywords + เซกเตอร์ + ธาตุ (เฉพาะที่ตรง — ไม่เดา) */
export function classifyNews(item: Pick<NewsItem, "title" | "description">): {
  keywords: string[];
  sectors: string[];
  elements: ThaiElement[];
} {
  const text = `${item.title} ${item.description ?? ""}`;
  const keywords: string[] = [];
  const sectors: string[] = [];
  const elements: ThaiElement[] = [];
  for (const rule of KEYWORD_MAP) {
    if (rule.re.test(text)) {
      keywords.push(rule.re.source);
      for (const s of rule.sectors) if (!sectors.includes(s)) sectors.push(s);
      if (!elements.includes(rule.element)) elements.push(rule.element);
    }
  }
  return { keywords, sectors, elements };
}

/** parse XML RSS → items (regex พอ — structure ง่าย ไม่ต้อง lib) */
export function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item[\s>](.*?)<\/item>/gs;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const grab = (tag: string) => {
      const t = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "s").exec(block);
      return t ? t[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() : "";
    };
    const title = grab("title");
    const link = grab("link");
    if (!title || !link) continue;
    const item: NewsItem = {
      title,
      link,
      pubDate: grab("pubDate"),
      source,
      description: grab("description") || undefined,
    };
    const cls = classifyNews(item);
    item.keywords = cls.keywords;
    item.sectors = cls.sectors;
    item.elements = cls.elements;
    items.push(item);
  }
  return items;
}

/** ดึงทุก feed → รวม + dedupe (link) */
export async function fetchAllNews(feeds = NEWS_FEEDS): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  for (const f of feeds) {
    try {
      const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      for (const item of parseRss(xml, f.source)) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);
        out.push(item);
      }
      console.log(`  ${f.source}: +${out.length} items (สะสม)`);
    } catch (e) {
      console.log(`  ⚠️ ${f.source}: ${(e as Error).message}`);
    }
  }
  return out;
}

/** กรองข่าวตาม keywords (ใช้กับแชท intent news_impact) */
export function filterNewsByKeywords(items: NewsItem[], keywords: string[], limit = 10): NewsItem[] {
  const re = new RegExp(keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  return items.filter((i) => re.test(`${i.title} ${i.description ?? ""}`)).slice(0, limit);
}
