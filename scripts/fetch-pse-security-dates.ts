/**
 * Enrich the normalized PSE Company List snapshot with security-level Stock Data pages.
 *
 * PSE's company directory normally exposes only one root security per issuer. Preferred
 * shares and other lines are available from the official Stock Data security selector,
 * where each exact security has its own Listing Date.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  matchPseOfficialDates,
  normalizePseCatalogTicker,
  parsePseCompanyDirectory,
  parsePseDirectoryPageCount,
  parsePseStockDataPage,
  parsePseStockDataSecurityOptions,
  pseCompanyDirectorySearchUrl,
  pseStockDataUrl,
  type PseCompanyDirectoryRow,
} from "../src/lib/research/pse-company-directory";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FILE = path.join(ROOT, "data", "staging", "pse-company-dates.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function saveAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

async function fetchOfficialHtml(url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          Referer: "https://edge.pse.com.ph/companyDirectory/form.do",
          "User-Agent": "Mozilla/5.0 bazi-investor-guide-research/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`PSE EDGE HTTP ${response.status}: ${url}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`PSE EDGE fetch failed: ${url}`);
}

function discoverRoot(
  targetSymbol: string,
  rows: readonly PseCompanyDirectoryRow[],
): PseCompanyDirectoryRow | null {
  const candidates = rows
    .filter((row) => targetSymbol !== row.symbol && targetSymbol.startsWith(row.symbol))
    .sort((a, b) => b.symbol.length - a.symbol.length || a.companyId.localeCompare(b.companyId));
  if (candidates.length === 0) return null;
  const longest = candidates[0].symbol.length;
  const longestCandidates = candidates.filter((row) => row.symbol.length === longest);
  return longestCandidates.length === 1 ? longestCandidates[0] : null;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      output[index] = await worker(values[index]);
    }
  }));
  return output;
}

async function main(): Promise<void> {
  const input = path.resolve(arg("input") ?? DEFAULT_FILE);
  const output = path.resolve(arg("output") ?? input);
  const payload = JSON.parse(readFileSync(input, "utf8")) as Record<string, unknown>;
  const existingRows = parsePseCompanyDirectory(payload);
  const stocks = getGlobalStocks().filter(isResearchableStock);
  const current = matchPseOfficialDates(stocks, existingRows, new Date().toISOString());
  const requestedTicker = arg("ticker")?.trim().toUpperCase();
  const unresolved = current
    .filter((record) => record.status !== "matched")
    .map((record) => record.normalizedTicker)
    .filter((ticker) => !requestedTicker || ticker === normalizePseCatalogTicker(requestedTicker));

  const needsDirectoryRefresh = unresolved.some((symbol) => discoverRoot(symbol, existingRows) === null);
  let directoryRows: PseCompanyDirectoryRow[] = [];
  if (needsDirectoryRefresh) {
    const firstPage = await fetchOfficialHtml(pseCompanyDirectorySearchUrl(1));
    const pageCount = parsePseDirectoryPageCount(firstPage);
    const remainingPages = await mapWithConcurrency(
      Array.from({ length: pageCount - 1 }, (_, index) => index + 2),
      5,
      async (pageNo) => fetchOfficialHtml(pseCompanyDirectorySearchUrl(pageNo)),
    );
    directoryRows = parsePseCompanyDirectory({ pages: [firstPage, ...remainingPages] });
  }
  const discoveryRows = [...new Map(
    [...existingRows, ...directoryRows].map((row) => [`${row.companyId}:${row.securityId}:${row.symbol}`, row]),
  ).values()];
  const discoveries = unresolved.map((symbol) => ({ symbol, root: discoverRoot(symbol, discoveryRows) }));
  const roots = [...new Map(
    discoveries
      .filter((item): item is { symbol: string; root: PseCompanyDirectoryRow } => item.root !== null)
      .map((item) => [`${item.root.companyId}:${item.root.securityId}`, item.root]),
  ).values()];
  const optionPages = await mapWithConcurrency(roots, 5, async (root) => ({
    root,
    html: await fetchOfficialHtml(pseStockDataUrl(root.companyId, root.securityId)),
  }));
  const optionsByCompany = new Map(optionPages.map(({ root, html }) => [
    root.companyId,
    parsePseStockDataSecurityOptions(html, root.companyId),
  ]));

  const exactOptions = discoveries.flatMap(({ symbol, root }) => {
    if (!root) return [];
    const option = optionsByCompany.get(root.companyId)?.find((item) => item.symbol === symbol);
    return option ? [option] : [];
  });
  const supplements = await mapWithConcurrency(exactOptions, 5, async (option) => {
    const url = pseStockDataUrl(option.companyId, option.securityId);
    const html = await fetchOfficialHtml(url);
    return parsePseStockDataPage(html, option.companyId, option.securityId);
  });

  const merged = [...new Map(
    [...discoveryRows, ...supplements].map((row) => [`${row.companyId}:${row.securityId}:${row.symbol}`, row]),
  ).values()].sort((a, b) => a.symbol.localeCompare(b.symbol) || a.companyId.localeCompare(b.companyId));
  const retrievedAt = new Date().toISOString();
  saveAtomic(output, {
    ...payload,
    schemaVersion: Number(payload.schemaVersion) || 1,
    retrievedAt,
    sourceRowCount: merged.length,
    records: merged,
  });

  const after = matchPseOfficialDates(stocks, merged, retrievedAt);
  console.log(JSON.stringify({
    input,
    output,
    catalog: after.length,
    matchedBefore: current.filter((record) => record.status === "matched").length,
    matchedAfter: after.filter((record) => record.status === "matched").length,
    unresolvedBefore: unresolved.length,
    directoryRowsFetched: directoryRows.length,
    rootPagesFetched: roots.length,
    securityPagesFetched: supplements.length,
    stillUnmatched: after.filter((record) => record.status !== "matched").map((record) => record.ticker),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
