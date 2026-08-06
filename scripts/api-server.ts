/**
 * API dev server — node:http (ไม่พึ่ง framework — ทดสอบ backend ด้วย curl)
 *
 * รัน: npx tsx scripts/api-server.ts [--port 8787]
 * เส้นทาง:
 *   POST /api/chat      { userId, message, useLlm? }
 *   POST /api/profile   { userId, birthDate, birthTime, gender, province }
 *   GET  /api/movers?market=TH&limit=5
 *   GET  /api/ipo?limit=5
 *   GET  /api/news?query=ทอง&limit=3
 *   GET  /api/almanac?date=2026-08-06
 *   GET  /api/fortune?userId=me&scope=week|month&asset=land
 *   GET  /api/report?ticker=KBANK&userId=me
 *   GET  /api/dashboard
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ok, err, type Query } from "../src/api/types";
import { handleProfile, handleChat } from "../src/api/chat";
import { handleMovers, handleIpo, handleNews, handleAlmanac, handleFortune, handleReport, handleAssets, handlePortfolio, handleReportPdf } from "../src/api/market";
import { handleDashboard } from "../src/api/dashboard";

const PORT = Number(process.argv[process.argv.indexOf("--port") + 1] ?? 8787);

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function sendRaw(res: ServerResponse, status: number, body: Buffer, contentType: string) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function parseQuery(url: string | undefined): Query {
  const q: Query = {};
  if (!url) return q;
  const i = url.indexOf("?");
  if (i < 0) return q;
  for (const pair of url.slice(i + 1).split("&")) {
    const [k, v] = pair.split("=");
    if (k) q[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  }
  return q;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = req.url ?? "/";
  const path = url.split("?")[0];
  const q = parseQuery(url);
  try {
    if (req.method === "POST" && path === "/api/profile") {
      return send(res, 200, handleProfile(await readBody(req)));
    }
    if (req.method === "POST" && path === "/api/chat") {
      const r = await handleChat(await readBody(req));
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === "GET" && path === "/api/movers") return send(res, 200, handleMovers(q));
    if (req.method === "GET" && path === "/api/ipo") return send(res, 200, handleIpo(q));
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
    return send(res, 500, err(`server error: ${(e as Error).message}`));
  }
});

server.listen(PORT, () => {
  console.log(`✅ API server: http://localhost:${PORT} (ทดสอบ: curl http://localhost:${PORT}/health)`);
});
