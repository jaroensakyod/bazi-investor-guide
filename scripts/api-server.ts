/**
 * API dev server — node:http (ไม่พึ่ง framework — ทดสอบ backend ด้วย curl)
 *
 * รัน: npx tsx scripts/api-server.ts [--port 8787]
 * เส้นทาง:
 *   POST /api/chat      { message, useLlm? } (identity มาจาก trusted BFF header)
 *   POST /api/profile   { birthDate, birthTime, gender, province }
 *   GET  /api/movers?market=TH&limit=5
 *   GET  /api/ipo?limit=5
 *   GET  /api/news?query=ทอง&limit=3
 *   GET  /api/almanac?date=2026-08-06
 *   GET  /api/fortune?scope=week|month&asset=land
 *   GET  /api/report?ticker=KBANK
 *   GET  /api/research?ticker=AAPL&market=NASDAQ
 *   POST /api/research      { ticker, market?, includeBazi? } (commit local preview snapshot + audit)
 *   GET  /api/research-screen?market=US&limit=20 (dev/internal จนกว่าจะผ่าน data/legal gates)
 *   GET  /api/dashboard
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ok, err, type Query } from "../src/api/types";
import { handleProfile, handleChat } from "../src/api/chat";
import { handleMovers, handleIpo, handleNews, handleAlmanac, handleFortune, handleReport, handleAssets, handlePortfolio, handleReportPdf, handleFullReportPdf, handleCardPdf, handleCardData, handleReportHtmlData, handleProductPdf, handleStocks, handleStockDetail, handleRefresh, handleSearch, handleIndices, handleWatchlist, handleExport, handlePicks, handlePersonal, handleResearch, handleResearchScreen } from "../src/api/market";
import { handleDashboard } from "../src/api/dashboard";
import {
  handleGetDecisionProfile,
  handleGetPortfolioLedger,
  handleUpsertDecisionProfile,
  handleUpsertPortfolioLedger,
} from "../src/api/decision-data";

const PORT = Number(process.argv[process.argv.indexOf("--port") + 1] ?? 8787);
const HOST = process.env.API_HOST?.trim() || "127.0.0.1";
const MAX_JSON_BYTES = 64 * 1024;
const USER_SCOPED_PATHS = new Set([
  "/api/profile",
  "/api/chat",
  "/api/fortune",
  "/api/report",
  "/api/report/pdf",
  "/api/report/full-pdf",
  "/api/card-pdf",
  "/api/card-data",
  "/api/report-html-data",
  "/api/product-pdf",
  "/api/personal",
  "/api/picks",
  "/api/portfolio",
  "/api/watchlist",
  "/api/research",
  "/api/decision-profile",
  "/api/portfolio-ledger",
]);

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
      reject(new HttpRequestError("request body ใหญ่เกิน 64 KB", 413));
      return;
    }
    let buf = "";
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      if (Buffer.byteLength(buf, "utf8") + chunk.length > MAX_JSON_BYTES) {
        tooLarge = true;
        buf = "";
        return;
      }
      buf += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (tooLarge) return reject(new HttpRequestError("request body ใหญ่เกิน 64 KB", 413));
      if (buf && !String(req.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
        return reject(new HttpRequestError("POST endpoint นี้รับเฉพาะ application/json", 415));
      }
      try {
        const parsed: unknown = buf ? JSON.parse(buf) : {};
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          return reject(new HttpRequestError("JSON body ต้องเป็น object", 400));
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new HttpRequestError("JSON body ไม่ถูกต้อง", 400));
      }
    });
    req.on("error", reject);
  });
}

function corsHeaders(): Record<string, string> {
  const origin = process.env.API_CORS_ORIGIN?.trim();
  return origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(body));
}

function sendRaw(res: ServerResponse, status: number, body: Buffer, contentType: string) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
  });
  res.end(body);
}

function parseQuery(url: string | undefined): Query {
  const q: Query = {};
  if (!url) return q;
  const i = url.indexOf("?");
  if (i < 0) return q;
  for (const pair of url.slice(i + 1).split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq >= 0 ? pair.slice(0, eq) : pair;
    const v = eq >= 0 ? pair.slice(eq + 1) : "";
    try {
      if (k) q[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
    } catch {
      // URL malformed (encode เพี้ยน) — ข้ามคู่นั้น กัน server crash
    }
  }
  return q;
}

function bodyAsQuery(body: Record<string, unknown>): Query {
  const q: Query = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") q[key] = String(value);
  }
  return q;
}

function headerValue(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : String(value ?? "");
}

function secretsMatch(expected: string, provided: string): boolean {
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(provided).digest();
  return timingSafeEqual(left, right);
}

function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function trustedSubject(req: IncomingMessage): { subjectId: string | null; error: string | null; status: number } {
  const subjectId = headerValue(req, "x-bazi-subject-id");
  if (!/^anon_[a-f0-9]{32}$/.test(subjectId)) {
    return { subjectId: null, error: "ไม่พบ session subject ที่เชื่อถือได้", status: 401 };
  }
  const expectedSecret = process.env.API_INTERNAL_SECRET?.trim();
  if (expectedSecret) {
    const providedSecret = headerValue(req, "x-bazi-internal-secret");
    if (!providedSecret || !secretsMatch(expectedSecret, providedSecret)) {
      return { subjectId: null, error: "internal service authentication ไม่ผ่าน", status: 401 };
    }
    return { subjectId, error: null, status: 200 };
  }
  if (process.env.NODE_ENV === "production") {
    return { subjectId: null, error: "API_INTERNAL_SECRET ยังไม่ได้ตั้งค่า", status: 503 };
  }
  if (!isLoopback(req.socket.remoteAddress)) {
    return { subjectId: null, error: "development subject รับได้จาก loopback เท่านั้น", status: 401 };
  }
  return { subjectId, error: null, status: 200 };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = req.url ?? "/";
  const path = url.split("?")[0];
  const q = parseQuery(url);
  try {
    const userScoped = USER_SCOPED_PATHS.has(path);
    const identity = userScoped ? trustedSubject(req) : { subjectId: null, error: null, status: 200 };
    if (identity.error) return send(res, identity.status, err(identity.error));
    delete q.userId;
    if (identity.subjectId) q.userId = identity.subjectId;
    const requestBody = req.method === "POST" ? await readBody(req) : {};
    delete requestBody.userId;
    delete requestBody.userid;
    if (identity.subjectId) requestBody.userId = identity.subjectId;

    if (req.method === "POST" && path === "/api/profile") {
      return send(res, 200, handleProfile(requestBody));
    }
    if (req.method === "POST" && path === "/api/chat") {
      const r = await handleChat(requestBody);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/decision-profile") {
      const r = handleGetDecisionProfile({ subjectId: identity.subjectId as string });
      return send(res, r.ok ? 200 : 404, r);
    }
    if (req.method === "POST" && path === "/api/decision-profile") {
      const r = handleUpsertDecisionProfile(requestBody, { subjectId: identity.subjectId as string });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/portfolio-ledger") {
      const r = handleGetPortfolioLedger({ subjectId: identity.subjectId as string });
      return send(res, r.ok ? 200 : 404, r);
    }
    if (req.method === "POST" && path === "/api/portfolio-ledger") {
      const r = handleUpsertPortfolioLedger(requestBody, { subjectId: identity.subjectId as string });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/movers") return send(res, 200, handleMovers(q));
    if (req.method === "GET" && path === "/api/ipo") {
      const r = await handleIpo(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/news") return send(res, 200, handleNews(q));
    if (req.method === "GET" && path === "/api/almanac") return send(res, 200, handleAlmanac(q));
    if (req.method === "GET" && path === "/api/fortune") {
      const r = await handleFortune(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/report") {
      const r = await handleReport(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/report/pdf") {
      const r = await handleReportPdf(q);
      if (!r.ok) return send(res, 400, err(r.error));
      return sendRaw(res, 200, r.data, "application/pdf");
    }
    if (req.method === "GET" && path === "/api/report/full-pdf") {
      const r = await handleFullReportPdf(q);
      if (!r.ok) return send(res, 400, err(r.error));
      return sendRaw(res, 200, r.data, "application/pdf");
    }
    if (req.method === "GET" && path === "/api/card-pdf") {
      const r = await handleCardPdf(q);
      if (!r.ok) return send(res, 400, err(r.error));
      return sendRaw(res, 200, r.data, "application/pdf");
    }
    if (req.method === "GET" && path === "/api/card-data") {
      const r = await handleCardData(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/report-html-data") {
      const r = await handleReportHtmlData(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "POST" && path === "/api/report-html-data") {
      const r = await handleReportHtmlData(bodyAsQuery(requestBody));
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/product-pdf") {
      const r = await handleProductPdf(q);
      if (!r.ok) return send(res, 400, err(r.error));
      return sendRaw(res, 200, r.data, "application/pdf");
    }
    if (req.method === "POST" && path === "/api/product-pdf") {
      const r = await handleProductPdf(bodyAsQuery(requestBody));
      if (!r.ok) return send(res, 400, err(r.error));
      return sendRaw(res, 200, r.data, "application/pdf");
    }
    if (req.method === "GET" && path === "/api/stocks") {
      const r = await handleStocks(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/stock") return send(res, 200, handleStockDetail(q));
    if (req.method === "GET" && path === "/api/search") return send(res, 200, handleSearch(q));
    if (req.method === "GET" && path === "/api/indices") return send(res, 200, handleIndices(q));
    if (req.method === "GET" && path === "/api/picks") {
      const r = await handlePicks(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/research") {
      const r = await handleResearch(q, {
        requestKind: "preview",
        releaseUse: process.env.NODE_ENV === "production" ? "public_display" : "internal_research",
      });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "POST" && path === "/api/research") {
      const r = await handleResearch(bodyAsQuery(requestBody), {
        requestKind: "commit",
        releaseUse: process.env.NODE_ENV === "production" ? "public_display" : "internal_research",
      });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/research-screen") {
      const r = await handleResearchScreen(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/personal") {
      const r = await handlePersonal(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/export") {
      const r = handleExport(q);
      if (!r.ok) return send(res, 400, err(r.error));
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${r.filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders(),
      });
      res.end("\uFEFF" + r.data, "utf8"); // BOM ให้ Excel เปิดไทยไม่เพี้ยน
      return;
    }
    if (req.method === "GET" && path === "/api/watchlist") {
      const r = await handleWatchlist(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "POST" && path === "/api/watchlist") {
      const r = await handleWatchlist(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "POST" && path === "/api/refresh") {
      const r = await handleRefresh(String(q.kind ?? ""));
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/assets") {
      const r = await handleAssets(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/portfolio") {
      const r = await handlePortfolio(q);
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/dashboard") return send(res, 200, handleDashboard());
    if (path === "/health") return send(res, 200, ok({ status: "ok" }));
    return send(res, 404, err(`ไม่พบเส้นทาง ${path}`));
  } catch (e) {
    const status = e instanceof HttpRequestError ? e.status : 500;
    const message = e instanceof HttpRequestError
      ? e.message
      : process.env.NODE_ENV === "production"
        ? "server error"
        : `server error: ${(e as Error).message}`;
    return send(res, status, err(message));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ API server: http://${HOST}:${PORT} (health: http://${HOST}:${PORT}/health)`);
});
