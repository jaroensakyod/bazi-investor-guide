/**
 * API handler: market/almanac/fortune/report — ครอบ tools ให้ frontend เรียก
 * ทุกตัว deterministic (tools) — LLM เฉพาะ chat route
 */
import { getTodayMovers } from "../lib/chat/tools";
import { getUpcomingIPOs } from "../lib/chat/tools";
import { getNewsImpact } from "../lib/chat/tools";
import { getTodayAlmanac } from "../lib/chat/tools";
import { getFortuneInvest } from "../lib/chat/tools";
import { loadUser, toggleWatchlist, type UserProfile } from "../lib/chat/user-store";
import { ok, err, type ApiResponse, type Query } from "./types";
import { stateOfProfile } from "./chat";
import { execFile } from "node:child_process";
import path from "node:path";
import { ROOT_DIR } from "./config";
import { getAllStocks } from "../lib/investor/stock-database";
import { loadSnapshot } from "../lib/market/market-data";
import { loadFundamentalsCache } from "../lib/market/fundamentals";
import { yahooTicker } from "../lib/market/yahoo";
import { buffettChecks, buffettScore } from "../lib/report/buffett-checks";
import { getAssets } from "../lib/assets/asset-universe";
import { INDICES, FX, FEATURED_ASSET_SYMBOLS } from "../lib/market/indices";

/** อัปเดตข้อมูล (IPO/ราคา/ข่าว) — รันสคริปต์ backend แล้วคืน output ท้ายสุด */
export function handleRefresh(kind: string): Promise<ApiResponse<unknown>> {
  const scripts: Record<string, [string, string[]]> = {
    ipo: ["npx", ["tsx", "scripts/ipo-pipeline.ts"]],
    prices: ["npx", ["tsx", "scripts/fetch-market-data.ts"]],
  };
  const cfg = scripts[kind];
  if (!cfg) return Promise.resolve(err(`refresh ไม่รู้จัก: ${kind} (มี: ${Object.keys(scripts).join(", ")})`));
  return new Promise((resolve) => {
    execFile(
      cfg[0],
      cfg[1],
      { cwd: ROOT_DIR, timeout: 120000, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
      (error: Error | null, stdout: string, stderr: string) => {
        const tail = `${stdout}\n${stderr}`.trim().split("\n").slice(-6).join("\n");
        if (error && (error as NodeJS.ErrnoException).code !== "ETIMEDOUT") {
          resolve(err(`refresh ${kind} ล้มเหลว: ${(error as Error).message}\n${tail}`));
        } else {
          resolve(ok({ kind, done: true, output: tail, timedOut: Boolean(error) }));
        }
      },
    );
  });
}

function num(q: Query, name: string, dflt?: number): number | undefined {
  const v = q[name];
  if (v === undefined) return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function handleMovers(q: Query): ApiResponse<unknown> {
  return ok(getTodayMovers({ market: q.market, limit: num(q, "limit", 10), direction: q.direction as "gainers" | "losers" | undefined }).data);
}

export function handleIpo(q: Query): ApiResponse<unknown> {
  return ok(getUpcomingIPOs({ market: q.market, limit: num(q, "limit", 10) }).data);
}

export function handleNews(q: Query): ApiResponse<unknown> {
  return ok(getNewsImpact({ query: q.query, market: q.market, limit: num(q, "limit", 8) }).data);
}

export function handleAlmanac(q: Query): ApiResponse<unknown> {
  return ok(getTodayAlmanac({ date: q.date }).data);
}

/** fortune ต้องมี profile (ดวงผู้ใช้) — scope: day/week/month · asset: stocks/land/ipo */
export async function handleFortune(q: Query): Promise<ApiResponse<unknown>> {
  const profile = loadUser(q.userId ?? "guest");
  if (!profile) return err("ยังไม่มีโปรไฟล์ — ลงทะเบียนก่อน (POST /api/profile)");
  const state = await stateOfProfile(profile);
  const res = getFortuneInvest(
    {
      scope: (q.scope as "day" | "week" | "month") ?? "day",
      asset: q.asset as "stocks" | "land" | "ipo" | undefined,
      date: q.date,
      year: num(q, "year"),
      month: num(q, "month"),
    },
    state,
  );
  return res.ok ? ok(res.data) : err(res.error ?? "fortune error");
}

export async function handleReport(q: Query): Promise<ApiResponse<unknown>> {
  const ticker = String(q.ticker ?? "").toUpperCase();
  if (!ticker) return err("ต้องระบุ ticker");
  const profile = loadUser(q.userId ?? "guest");
  const state = profile ? await stateOfProfile(profile) : undefined;
  const { generateReport, getAssetReport } = await import("../lib/chat/tools");
  const res = generateReport(ticker, state);
  if (res.ok) return ok(res.data);
  // ไม่ใช่หุ้น → ลองสินทรัพย์ (ทอง/เงิน/คริปโต/ที่ดิน...)
  const asset = getAssetReport(ticker, state);
  if (asset.ok) return ok(asset.data);
  return err(res.error ?? asset.error ?? "ไม่พบรายการนี้ในคลัง");
}

/** ค้นหุ้น + สินทรัพย์ (สำหรับช่องเลือกในหน้า report) */
export function handleSearch(q: Query): ApiResponse<unknown> {
  const query = (q.q ?? "").toLowerCase().trim();
  if (!query) return ok({ stocks: [], assets: [] });
  const stocks = getAllStocks()
    .filter((s) => s.ticker.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || (s.nameEn ?? "").toLowerCase().includes(query))
    .slice(0, 10)
    .map((s) => ({ kind: "stock" as const, ticker: s.ticker, name: s.name, market: s.market, element: s.primaryElement }));
  const assets = getAssets()
    .filter((a) => a.ticker.toLowerCase().includes(query) || a.name.toLowerCase().includes(query))
    .slice(0, 10)
    .map((a) => ({ kind: "asset" as const, ticker: a.ticker, name: a.name, market: a.type, element: a.primaryElement }));
  return ok({ stocks, assets });
}

/** สินทรัพย์นอกหุ้น × ดวง (ต้องมี profile) */
export async function handleAssets(q: Query): Promise<ApiResponse<unknown>> {
  const profile = loadUser(q.userId ?? "guest");
  if (!profile) return err("ยังไม่มีโปรไฟล์ — ลงทะเบียนก่อน (POST /api/profile)");
  const state = await stateOfProfile(profile);
  const { getAssetVerdicts } = await import("../lib/chat/tools");
  const res = getAssetVerdicts(state, { type: q.type, limit: Number(q.limit ?? 51) });
  return res.ok ? ok(res.data) : err(res.error ?? "assets error");
}

/** จัดสรรพอร์ตตามดวง (ต้องมี profile) */
export async function handlePortfolio(q: Query): Promise<ApiResponse<unknown>> {
  const profile = loadUser(q.userId ?? "guest");
  if (!profile) return err("ยังไม่มีโปรไฟล์ — ลงทะเบียนก่อน (POST /api/profile)");
  const state = await stateOfProfile(profile);
  const { getPortfolioAllocation } = await import("../lib/chat/tools");
  const res = getPortfolioAllocation(state);
  return res.ok ? ok(res.data) : err(res.error ?? "portfolio error");
}

/** คลังหุ้นทั้งหมด — แบ่งตามตลาด + ค้น (ราคาจาก snapshot) */
export function handleStocks(q: Query): ApiResponse<unknown> {
  const snap = loadSnapshot();
  const query = (q.q ?? "").toLowerCase().trim();
  const marketIn = q.market ?? "";
  const marketAlias: Record<string, string[]> = { th: ["SET", "mai"], us: ["NYSE", "NASDAQ", "NYSE/NASDAQ"], cn: ["SSE", "SZSE"], eu: ["LSE", "XETR", "EPA", "SWX"] };
  const markets = marketAlias[marketIn.toLowerCase()] ?? (marketIn ? [marketIn] : []);
  const all = getAllStocks()
    .filter((s) => markets.length === 0 || markets.includes(s.market))
    .filter((s) => !query || s.ticker.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || (s.nameEn ?? "").toLowerCase().includes(query))
    .map((s) => {
      const md = snap?.quotes[yahooTicker(s.ticker, s.market) ?? ""];
      return { ticker: s.ticker, name: s.name, market: s.market, country: s.country, sector: s.sector, element: s.primaryElement, tier: s.tier, price: md?.price ?? null, changePct: md?.changePct ?? null };
    });
  const marketCounts: Record<string, number> = {};
  for (const s of getAllStocks()) marketCounts[s.market] = (marketCounts[s.market] ?? 0) + 1;
  return ok({ count: all.length, total: getAllStocks().length, markets: marketCounts, stocks: all.slice(0, Number(q.limit ?? 200)) });
}

/** รายละเอียดหุ้นตัวเดียว (ประกอบกิจการอะไร + ราคาวันนี้ + พื้นฐานถ้ามี) */
export function handleStockDetail(q: Query): ApiResponse<unknown> {
  const ticker = String(q.ticker ?? "").toUpperCase();
  const market = q.market ? String(q.market) : "";
  // ticker ซ้ำข้ามตลาดได้ (FPT@HOSE vs FPT@SET) → ต้อง match ticker+market (หรือตัวแรกถ้าไม่ระบุ)
  const stock = market
    ? getAllStocks().find((s) => s.ticker.toUpperCase() === ticker && s.market === market)
    : getAllStocks().find((s) => s.ticker.toUpperCase() === ticker);
  if (!stock) return err(`ไม่พบหุ้น ${ticker}${market ? ` (${market})` : ""} ในคลัง`);
  const snap = loadSnapshot();
  const yt = yahooTicker(stock.ticker, stock.market) ?? "";
  const md = snap?.quotes[yt];
  const fund = loadFundamentalsCache().get(yt);
  return ok({
    ticker: stock.ticker,
    name: stock.name,
    nameEn: stock.nameEn ?? null,
    market: stock.market,
    country: stock.country,
    currency: stock.currency,
    sector: stock.sector,
    business: stock.business,
    theme: stock.theme,
    growthStage: stock.growthStage,
    listedDate: stock.listedDate,
    elements: stock.elements,
    primaryElement: stock.primaryElement,
    elementReason: stock.elementReason,
    tier: stock.tier,
    risingStar: stock.risingStar,
    isHighLiquidity: stock.isHighLiquidity,
    price: md?.price ?? null,
    changePct: md?.changePct ?? null,
    updatedAt: snap?.updatedAt ?? null,
    fundamentals: fund ? { roe: fund.roe, profitMargin: fund.profitMargin, revenueGrowth: fund.revenueGrowth, debtToEquity: fund.debtToEquity, buffettScore: buffettScore(buffettChecks(fund)) } : null,
  });
}

/** ภาพรวมตลาดสไตล์ investing.com — ดัชนี/FX/สินทรัพย์เด่น (จาก snapshot) */
export function handleIndices(q: Query): ApiResponse<unknown> {
  const snap = loadSnapshot();
  const qq = snap?.quotes ?? {};
  const pick = (sym: string) => {
    const md = qq[sym];
    return md ? { symbol: sym, price: md.price, changePct: md.changePct } : null;
  };
  const indices = INDICES.map((i) => ({ name: i.name, region: i.region, ...(pick(i.symbol) ?? { price: null, changePct: null }) })).filter((i) => i.price != null);
  const forex = FX.map((f) => ({ name: f.name, ...(pick(f.symbol) ?? { price: null, changePct: null }) })).filter((f) => f.price != null);
  const assets = FEATURED_ASSET_SYMBOLS.map((sym) => {
    const a = getAssets().find((x) => x.ticker === sym);
    const md = pick(sym);
    return { ticker: sym, name: a?.name ?? sym, type: a?.type ?? "asset", element: a?.primaryElement ?? null, price: md?.price ?? null, changePct: md?.changePct ?? null };
  }).filter((a) => a.price != null);
  return ok({ updatedAt: snap?.updatedAt ?? null, indices, forex, assets });
}

/** Watchlist — GET: รายการพร้อมราคา/verdict · POST {action:add|remove, entry} */
export async function handleWatchlist(q: Query): Promise<ApiResponse<unknown>> {
  const userId = String(q.userId ?? "");
  const profile = loadUser(userId);
  if (!profile) return err("ยังไม่มีโปรไฟล์ — กรอกวันเกิดก่อน (หน้าโปรไฟล์)");
  const entries = profile.watchlist ?? [];

  if (q.action) {
    const entry = String(q.entry ?? "");
    if (!entry) return err("ต้องระบุ entry (เช่น s:SET:KBANK / a:GC=F)");
    const list = toggleWatchlist(userId, entry);
    return ok({ entries: list, entry });
  }

  const state = await stateOfProfile(profile);
  const snap = loadSnapshot();
  const rows = [];
  for (const e of entries) {
    if (e.startsWith("s:")) {
      const [, market, ticker] = e.split(":");
      const stock = getAllStocks().find((s) => s.ticker === ticker && s.market === market);
      if (!stock) continue;
      const md = snap?.quotes[yahooTicker(stock.ticker, stock.market) ?? ""];
      rows.push({ entry: e, kind: "stock", ticker: stock.ticker, name: stock.name, market: stock.market, element: stock.primaryElement, price: md?.price ?? null, changePct: md?.changePct ?? null });
    } else if (e.startsWith("a:")) {
      const ticker = e.slice(2);
      const asset = getAssets().find((a) => a.ticker === ticker);
      if (!asset) continue;
      const md = snap?.quotes[asset.ticker];
      rows.push({ entry: e, kind: "asset", ticker: asset.ticker, name: asset.name, market: asset.type, element: asset.primaryElement, price: md?.price ?? null, changePct: md?.changePct ?? null });
    }
  }
  return ok({ entries, rows, updatedAt: snap?.updatedAt ?? null });
}

/** PDF รายงานสไตล์สถาบัน — คืน Buffer (ดาวน์โหลด .pdf) */
export async function handleReportPdf(q: Query): Promise<{ ok: true; data: Buffer } | { ok: false; error: string }> {
  const ticker = String(q.ticker ?? "").toUpperCase();
  if (!ticker) return { ok: false, error: "ต้องระบุ ticker" };
  const profile = loadUser(q.userId ?? "guest");
  const state = profile ? await stateOfProfile(profile) : undefined;
  const { buildReportPdf } = await import("./report-pdf");
  try {
    return { ok: true, data: await buildReportPdf(ticker, state) };
  } catch (e) {
    return { ok: false, error: `PDF error: ${(e as Error).message}` };
  }
}

export type { UserProfile };
