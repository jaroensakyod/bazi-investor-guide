/**
 * News layer — ดึงข่าวการเงินจาก RSS (ฟรี ไม่มี key) + จำแนก keywords→เซกเตอร์→ธาตุ
 *
 * Feed:
 *   - Global (EN): Yahoo Finance / Investing.com / MarketWatch
 *   - ต่อตลาด (Google News RSS — curl ได้ ฟรี หลายภาษา): TH/CN/TW/VN/JP/KR/ID/MY
 *     รูปแบบ: news.google.com/rss/search?q=<คำค้น>&hl=<lang>&gl=<country>&ceid=<c>:<l>
 *
 * หลัก "ไม่เดา": keyword→ธาตุ เป็นตารางชัดเจน (เพิ่มได้ผ่าน review) — LLM เอาไปวิเคราะห์ต่อในแชท
 */
import type { ThaiElement } from "../investor/stock-database";

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string; // ISO หรือ RFC822 ดิบ
  source: string;
  /** ตลาดที่ข่าวเกี่ยวข้อง (TH/CN/TW/VN/JP/KR/ID/MY/GLOBAL) — ใช้กรอง "ข่าวไทย" ในแชท */
  market?: string;
  description?: string;
  /** จำแนกอัตโนมัติ (classifyNews) */
  keywords?: string[];
  sectors?: string[];
  elements?: ThaiElement[];
};

export const NEWS_FEEDS: Array<{ url: string; source: string; market?: string }> = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance", market: "GLOBAL" },
  { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com", market: "GLOBAL" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch", market: "GLOBAL" },
];

/** Google News RSS ต่อตลาด (ภาษาท้องถิ่น) — ข่าวการเงิน/หุ้นรายประเทศ */
export const GOOGLE_NEWS_FEEDS: Array<{ url: string; source: string; market: string }> = [
  { url: "https://news.google.com/rss/search?q=%E0%B8%AB%E0%B8%B8%E0%B9%89%E0%B8%99%20OR%20%E0%B8%95%E0%B8%A5%E0%B8%B2%E0%B8%94%E0%B8%AB%E0%B8%B8%E0%B9%89%E0%B8%99&hl=th&gl=TH&ceid=TH:th", source: "Google News TH", market: "TH" },
  { url: "https://news.google.com/rss/search?q=%E8%82%A1%E5%B8%82%20OR%20A%E8%82%A1&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", source: "Google News CN", market: "CN" },
  { url: "https://news.google.com/rss/search?q=%E8%82%A1%E5%B8%82%20%E5%8F%B0%E7%81%A3&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", source: "Google News TW", market: "TW" },
  { url: "https://news.google.com/rss/search?q=ch%E1%BB%A9ng%20kho%C3%A1n&hl=vi&gl=VN&ceid=VN:vi", source: "Google News VN", market: "VN" },
  { url: "https://news.google.com/rss/search?q=%E6%A0%AA%E5%BC%8F%E5%B8%82%E5%A0%B4&hl=ja&gl=JP&ceid=JP:ja", source: "Google News JP", market: "JP" },
  { url: "https://news.google.com/rss/search?q=%EC%A3%BC%EC%8B%9D%EC%8B%9C%EC%9E%A5&hl=ko&gl=KR&ceid=KR:ko", source: "Google News KR", market: "KR" },
  { url: "https://news.google.com/rss/search?q=saham&hl=id&gl=ID&ceid=ID:id", source: "Google News ID", market: "ID" },
  { url: "https://news.google.com/rss/search?q=saham%20bursa&hl=ms&gl=MY&ceid=MY:ms", source: "Google News MY", market: "MY" },
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
export function parseRss(xml: string, source: string, market?: string): NewsItem[] {
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
      market,
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

/** ดึงทุก feed (global + Google News ต่อตลาด) → รวม + dedupe (link) */
export async function fetchAllNews(feeds = [...NEWS_FEEDS, ...GOOGLE_NEWS_FEEDS]): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  for (const f of feeds) {
    try {
      const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      for (const item of parseRss(xml, f.source, f.market)) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);
        out.push(item);
      }
    } catch {
      /* feed เสีย — ข้าม */
    }
  }
  return out;
}

/** กรองข่าวตามตลาด (แชท: "ข่าวไทย" → market=TH) */
export function filterNewsByMarket(items: NewsItem[], market: string, limit = 10): NewsItem[] {
  return items.filter((i) => i.market === market).slice(0, limit);
}

/** กรองข่าวตาม keywords (ใช้กับแชท intent news_impact) */
export function filterNewsByKeywords(items: NewsItem[], keywords: string[], limit = 10): NewsItem[] {
  const re = new RegExp(keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  return items.filter((i) => re.test(`${i.title} ${i.description ?? ""}`)).slice(0, limit);
}
