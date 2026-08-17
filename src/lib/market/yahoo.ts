/**
 * Yahoo Finance client — ราคา/valuation แบบ batch (v7 quote) + fundamentals (v10 quoteSummary)
 *
 * Pattern ต่อยอดจาก scripts/enrich-descriptions-yahoo.ts (cookie/crumb + suffix map + retry)
 * ใช้กับทุกตลาดในคลัง (ไทย/โลก/เอเชียใหม่) + สินทรัพย์ (GC=F/SI=F/CL=F/forex)
 *
 * ราคา = unofficial API — ใช้ใน MVP (abstraction อยู่ที่ market-data.ts สลับ backend ได้)
 */
export const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** suffix Yahoo ตามตลาด — ถ้า ticker มี suffix อยู่แล้ว (0700.HK) ใช้ตามเดิม */
const YAHOO_SUFFIX: Record<string, string> = {
  SET: ".BK",
  mai: ".BK",
  HKEX: ".HK",
  SSE: ".SS",
  SZSE: ".SZ",
  TSE: ".T", // ญี่ปุ่น (Nikkei)
  KRX: ".KS",
  HOSE: ".VN",
  ASX: ".AX",
  TSX: ".TO", // แคนาดา
  NSE: ".NS",
  // เอเชียใหม่ (Task 0.15)
  TWSE: ".TW",
  TPEx: ".TWO",
  SGX: ".SI",
  IDX: ".JK",
  BURSA: ".KL",
  PSE: ".PS",
  // ยุโรป (Task 0.14) — LSE ticker ลงท้ายจุด (RR.) ตัดทิ้งก่อน
  LSE: ".L",
  XETR: ".DE",
  EPA: ".PA",
  SWX: ".SW",
  // ชุด 3 (PK/SA/BR)
  KSE: ".PK", // ปากีสถาน (ต่างจาก KRX .KS)
  TADAWUL: ".SR",
  BOVESPA: ".SA",
  // LatAm/Africa (MX/TR/ZA)
  BMV: ".MX", // class share: GMEXICO/B → GMEXICO.B (จัดการด้านล่าง)
  BIST: ".IS",
  JSE: ".JO",
};

/** แปลง ticker ในคลังเรา → รูปแบบ Yahoo (zero-pad HK, class-share ใช้ขีด, ฯลฯ) */
export function yahooTicker(ticker: string, market = ""): string {
  let raw = String(ticker ?? "").trim();
  if (!raw) return "";
  const mkt = String(market ?? "");
  // ฮ่องกง: Yahoo ต้อง zero-pad 4 หลัก (2.HK → 0002.HK)
  if (mkt === "HKEX" && /^\d+\.HK$/.test(raw)) {
    raw = raw.split(".")[0].padStart(4, "0") + ".HK";
  }
  // เม็กซิโก class share: GMEXICO.B → GMEXICO.B.MX (มีจุดแล้วแต่ต้องเติม suffix ต่อ)
  if (mkt === "BMV" && !raw.endsWith(".MX")) return raw + ".MX";
  // หุ้น class (BF.B / BRK.B / GIB.A.TO): Yahoo ใช้ขีด (BF-B / GIB-A.TO)
  if (/^\w+\.\w+\.(TO|AX|VN|BK|NS|T|KS|SS|SZ|HK|TW|TWO|SI|JK|KL|PS)$/.test(raw)) {
    raw = raw.replace(".", "-");
  } else if (mkt.includes("NYSE") || mkt.includes("NASDAQ")) {
    // US share classes and preferred series: BRK.B -> BRK-B, BAC/PB -> BAC-PB.
    raw = raw.replace(/[./]/g, "-");
  }
  if (raw.includes(".")) return raw; // มี suffix อยู่แล้ว
  if (mkt.includes("NYSE") || mkt.includes("NASDAQ") || mkt === "SP500" || mkt === "US") return raw;
  const suffix = YAHOO_SUFFIX[mkt];
  return suffix ? raw + suffix : raw;
}

/** เปิด session Yahoo (cookie + crumb) — ใช้กับ quoteSummary/quote */
export async function openYahooSession(): Promise<{ cookie: string; crumb: string }> {
  let cookie = "";
  try {
    const cj = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": YAHOO_UA }, redirect: "manual" });
    const setCookies = cj.headers.getSetCookie?.() ?? [];
    cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  } catch {
    /* ignore */
  }
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": YAHOO_UA, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumbRes.status !== 200) throw new Error("Yahoo crumb ไม่สำเร็จ");
  return { cookie, crumb };
}

async function fetchJson(url: string, cookie: string, retries = 4, onRateLimited?: () => void): Promise<unknown | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA, Cookie: cookie } });
      if (res.status === 429 || res.status === 999) {
        onRateLimited?.();
        const wait = 5000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

/** ข้อมูลดิบจาก v7 quote — ฟิลด์ที่เราใช้ */
export type YahooQuote = {
  symbol: string;
  /** Provider metadata only: may be the beginning of Yahoo history, not the legal listing date. */
  firstTradeDateMilliseconds?: number;
  exchangeTimezoneName?: string;
  exchange?: string;
  fullExchangeName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  priceToBook?: number;
  /** Yahoo v7 quote returns percentage points (for example 2.62 means 2.62%). */
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

/**
 * fetch ราคาแบบ batch (v7/finance/quote) — ทีละ 25 ตัว/request
 * คืน Map<yahooTicker, YahooQuote> เฉพาะตัวที่มีราคา
 *
 * ปลอดภัยกับ rate limit:
 *  - batch 25 ตัว/request → 2,900 หุ้น = ~116 requests เท่านั้น
 *  - หน่วง delayMs ระหว่าง chunk (ค่าเริ่มต้น 800ms ≈ 1.2 req/s)
 *  - retry 429/999 แบบ backoff (5s→10s→15s→20s)
 *  - circuit breaker: 429 ติดกัน 3 ครั้ง → หยุดทันที (save ของที่ได้ ค่อยรันต่อ)
 */
export async function fetchQuotes(
  symbols: string[],
  session: { cookie: string; crumb: string },
  chunkSize = 25,
  delayMs = 800,
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<Map<string, YahooQuote>> {
  const out = new Map<string, YahooQuote>();
  let consecutive429 = 0;
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(","))}&crumb=${encodeURIComponent(session.crumb)}`;
    const json = (await fetchJson(url, session.cookie, 4, () => {
      consecutive429 += 1;
      // Intentional operator-facing circuit-breaker notice for long-running research fetches.
      // eslint-disable-next-line no-console
      if (consecutive429 === 3) console.warn("⚠️ โดน 429 ติดกัน 3 ครั้ง — หยุดก่อน (circuit breaker) บันทึกของที่ได้แล้ว รันซ้ำทีหลัง");
    })) as { quoteResponse?: { result?: YahooQuote[] } } | null;
    const results = json?.quoteResponse?.result ?? [];
    if (results.length > 0) consecutive429 = 0;
    for (const q of results) {
      if (q.symbol && typeof q.regularMarketPrice === "number") out.set(q.symbol, q);
    }
    opts.onProgress?.(Math.min(i + chunkSize, symbols.length), symbols.length);
    if (consecutive429 >= 3) break;
    if (i + chunkSize < symbols.length) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

/** v10 quoteSummary (modules ละเอียด — fundamentals ใช้ใน Task 0.5) */
export async function fetchQuoteSummaryModule(
  ticker: string,
  module: string,
  session: { cookie: string; crumb: string },
): Promise<Record<string, unknown> | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}?modules=${module}&crumb=${encodeURIComponent(session.crumb)}&lang=en-US&region=US`;
  const json = (await fetchJson(url, session.cookie, 3)) as
    | { quoteSummary?: { result?: Array<Record<string, unknown>> } }
    | null;
  return (json?.quoteSummary?.result?.[0]?.[module] as Record<string, unknown> | undefined) ?? null;
}
