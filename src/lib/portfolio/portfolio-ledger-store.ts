import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeUserId } from "../chat/user-store";
import { validatePortfolioLedger, type PortfolioLedger } from "./portfolio-ledger";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const PORTFOLIO_LEDGER_DIR = path.join(ROOT, "data/portfolio-ledgers");

export function portfolioLedgerFile(profileId: string, root = PORTFOLIO_LEDGER_DIR): string {
  return path.join(root, sanitizeUserId(profileId) + ".json");
}

export function savePortfolioLedger(ledger: PortfolioLedger, root = PORTFOLIO_LEDGER_DIR): string {
  const problems = validatePortfolioLedger(ledger);
  if (problems.length > 0) throw new Error(problems.join("; "));
  mkdirSync(root, { recursive: true });
  const file = portfolioLedgerFile(ledger.profileId, root);
  const temporary = file + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  renameSync(temporary, file);
  return file;
}

export function loadPortfolioLedger(profileId: string, root = PORTFOLIO_LEDGER_DIR): PortfolioLedger | null {
  const file = portfolioLedgerFile(profileId, root);
  if (!existsSync(file)) return null;
  try {
    const ledger = JSON.parse(readFileSync(file, "utf8")) as PortfolioLedger;
    return validatePortfolioLedger(ledger).length === 0 ? ledger : null;
  } catch {
    return null;
  }
}
