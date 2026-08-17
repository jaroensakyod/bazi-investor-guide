import { z } from "zod";
import { stableSha256 } from "../research/canonical-json";

export const PORTFOLIO_LEDGER_SCHEMA_VERSION = 1 as const;

const identifier = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
const text = z.string().trim().min(1).max(2_000);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "ต้องเป็นวันที่ที่อ่านได้");
const currency = z.string().regex(/^[A-Z]{3}$/);
const nonNegative = z.number().finite().min(0).max(1_000_000_000_000);
const positive = z.number().finite().positive().max(1_000_000_000_000);

export const portfolioAccountSchema = z.object({
  id: identifier,
  name: text,
  type: z.enum(["brokerage", "retirement", "bank", "crypto", "other"]),
  baseCurrency: currency,
  country: z.string().trim().min(2).max(2),
  allowNegativeCash: z.boolean(),
});

export const portfolioTransactionSchema = z.object({
  id: identifier,
  accountId: identifier,
  occurredAt: timestamp,
  type: z.enum([
    "opening_cash",
    "opening_position",
    "deposit",
    "withdrawal",
    "buy",
    "sell",
    "dividend",
    "fee",
    "tax",
    "split",
    "transfer_in",
    "transfer_out",
  ]),
  securityId: identifier.nullable(),
  currency,
  quantity: positive.nullable(),
  unitPrice: nonNegative.nullable(),
  amount: positive.nullable(),
  splitRatio: positive.nullable(),
  fees: nonNegative,
  taxes: nonNegative,
  source: z.enum(["user", "broker_import", "system_corporate_action"]),
  externalRef: z.string().trim().max(256).nullable(),
  note: z.string().trim().max(2_000).nullable(),
  createdAt: timestamp,
});

export const portfolioLedgerSchema = z.object({
  schemaVersion: z.literal(PORTFOLIO_LEDGER_SCHEMA_VERSION),
  ledgerId: z.string().regex(/^portfolio_[a-f0-9]{24}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  profileId: identifier,
  asOf: timestamp,
  accounts: z.array(portfolioAccountSchema).min(1).max(100),
  transactions: z.array(portfolioTransactionSchema).max(1_000_000),
  createdAt: timestamp,
});

export type PortfolioAccount = z.infer<typeof portfolioAccountSchema>;
export type PortfolioTransaction = z.infer<typeof portfolioTransactionSchema>;
export type PortfolioLedger = z.infer<typeof portfolioLedgerSchema>;
export type PortfolioLedgerDraft = {
  profileId: string;
  asOf: string;
  accounts: PortfolioAccount[];
  transactions: PortfolioTransaction[];
};

function sortedTransactions(transactions: PortfolioTransaction[]): PortfolioTransaction[] {
  return [...transactions].sort((left, right) =>
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id)
  );
}

function identityPayload(ledger: PortfolioLedger | PortfolioLedgerDraft): unknown {
  return {
    profileId: ledger.profileId,
    asOf: ledger.asOf,
    accounts: [...ledger.accounts].sort((left, right) => left.id.localeCompare(right.id)),
    transactions: sortedTransactions(ledger.transactions),
  };
}

export function portfolioLedgerContentHash(ledger: PortfolioLedger | PortfolioLedgerDraft): string {
  return stableSha256(identityPayload(ledger));
}

export function createPortfolioLedger(
  draft: PortfolioLedgerDraft,
  createdAt = new Date().toISOString(),
): PortfolioLedger {
  const normalized: PortfolioLedgerDraft = {
    ...draft,
    accounts: [...draft.accounts].sort((left, right) => left.id.localeCompare(right.id)),
    transactions: sortedTransactions(draft.transactions),
  };
  const contentHash = portfolioLedgerContentHash(normalized);
  const ledger: PortfolioLedger = {
    ...normalized,
    schemaVersion: PORTFOLIO_LEDGER_SCHEMA_VERSION,
    ledgerId: "portfolio_" + contentHash.slice(0, 24),
    contentHash,
    createdAt,
  };
  const problems = validatePortfolioLedger(ledger);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return ledger;
}

function duplicateIds(items: Array<{ id: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function transactionProblems(transaction: PortfolioTransaction): string[] {
  const problems: string[] = [];
  const trade = transaction.type === "buy" || transaction.type === "sell" || transaction.type === "opening_position";
  const cash = [
    "opening_cash",
    "deposit",
    "withdrawal",
    "dividend",
    "fee",
    "tax",
    "transfer_in",
    "transfer_out",
  ].includes(transaction.type);
  if (trade) {
    if (!transaction.securityId) problems.push(transaction.id + " ต้องมี securityId");
    if (!transaction.quantity) problems.push(transaction.id + " ต้องมี quantity");
    if (transaction.unitPrice === null) problems.push(transaction.id + " ต้องมี unitPrice");
  }
  if (cash && !transaction.amount) problems.push(transaction.id + " ต้องมี amount");
  if (transaction.type === "dividend" && !transaction.securityId) problems.push(transaction.id + " dividend ต้องมี securityId");
  if (transaction.type === "split") {
    if (!transaction.securityId) problems.push(transaction.id + " split ต้องมี securityId");
    if (!transaction.splitRatio) problems.push(transaction.id + " split ต้องมี splitRatio");
  }
  if (!trade && (transaction.quantity !== null || transaction.unitPrice !== null)) {
    problems.push(transaction.id + " ใช้ quantity/unitPrice กับ transaction type นี้ไม่ได้");
  }
  if (transaction.type !== "split" && transaction.splitRatio !== null) {
    problems.push(transaction.id + " ใช้ splitRatio ได้เฉพาะ split");
  }
  if (!cash && transaction.amount !== null) problems.push(transaction.id + " ใช้ amount กับ transaction type นี้ไม่ได้");
  return problems;
}

type MutablePosition = {
  accountId: string;
  securityId: string;
  currency: string;
  quantity: number;
  totalCost: number;
  realizedPnl: number;
};

export type PortfolioPosition = MutablePosition & {
  averageCost: number;
};

export type PortfolioCashBalance = {
  accountId: string;
  currency: string;
  amount: number;
};

export type PortfolioReconciliation = {
  ledgerId: string;
  asOf: string;
  positions: PortfolioPosition[];
  cash: PortfolioCashBalance[];
  warnings: string[];
};

function round(value: number, digits = 8): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function positionKey(transaction: PortfolioTransaction): string {
  return transaction.accountId + "|" + transaction.securityId + "|" + transaction.currency;
}

function cashKey(accountId: string, currencyCode: string): string {
  return accountId + "|" + currencyCode;
}

function addCash(cash: Map<string, PortfolioCashBalance>, accountId: string, currencyCode: string, amount: number): void {
  const key = cashKey(accountId, currencyCode);
  const current = cash.get(key) ?? { accountId, currency: currencyCode, amount: 0 };
  current.amount = round(current.amount + amount, 4);
  cash.set(key, current);
}

export function reconcilePortfolioLedger(ledger: PortfolioLedger): PortfolioReconciliation {
  const parsed = portfolioLedgerSchema.safeParse(ledger);
  if (!parsed.success) throw new Error("portfolio ledger schema ไม่ถูกต้อง");
  const semanticProblems = ledger.transactions.flatMap(transactionProblems);
  if (semanticProblems.length > 0) throw new Error(semanticProblems.join("; "));

  const accounts = new Map(ledger.accounts.map((account) => [account.id, account]));
  const positions = new Map<string, MutablePosition>();
  const cash = new Map<string, PortfolioCashBalance>();
  const warnings: string[] = [];

  for (const transaction of sortedTransactions(ledger.transactions)) {
    if (!accounts.has(transaction.accountId)) throw new Error(transaction.id + " อ้าง accountId ที่ไม่มี");
    if (Date.parse(transaction.occurredAt) > Date.parse(ledger.asOf)) {
      throw new Error(transaction.id + " เกิดหลัง ledger asOf");
    }

    if (transaction.type === "opening_cash" || transaction.type === "deposit" || transaction.type === "transfer_in") {
      addCash(cash, transaction.accountId, transaction.currency, transaction.amount as number);
      continue;
    }
    if (transaction.type === "withdrawal" || transaction.type === "fee" || transaction.type === "tax" || transaction.type === "transfer_out") {
      addCash(cash, transaction.accountId, transaction.currency, -(transaction.amount as number));
      continue;
    }
    if (transaction.type === "dividend") {
      addCash(cash, transaction.accountId, transaction.currency, transaction.amount as number);
      continue;
    }

    const key = positionKey(transaction);
    const current = positions.get(key) ?? {
      accountId: transaction.accountId,
      securityId: transaction.securityId as string,
      currency: transaction.currency,
      quantity: 0,
      totalCost: 0,
      realizedPnl: 0,
    };

    if (transaction.type === "split") {
      if (current.quantity <= 0) throw new Error(transaction.id + " split ไม่มี position ต้นทาง");
      current.quantity = round(current.quantity * (transaction.splitRatio as number));
      positions.set(key, current);
      continue;
    }

    const quantity = transaction.quantity as number;
    const unitPrice = transaction.unitPrice as number;
    const tradeAmount = quantity * unitPrice;
    if (transaction.type === "opening_position") {
      current.quantity = round(current.quantity + quantity);
      current.totalCost = round(current.totalCost + tradeAmount + transaction.fees + transaction.taxes, 4);
      positions.set(key, current);
      continue;
    }
    if (transaction.type === "buy") {
      current.quantity = round(current.quantity + quantity);
      current.totalCost = round(current.totalCost + tradeAmount + transaction.fees + transaction.taxes, 4);
      addCash(cash, transaction.accountId, transaction.currency, -(tradeAmount + transaction.fees + transaction.taxes));
      positions.set(key, current);
      continue;
    }
    if (quantity > current.quantity + 0.00000001) throw new Error(transaction.id + " ขายเกินจำนวนที่มี");
    const averageCost = current.quantity > 0 ? current.totalCost / current.quantity : 0;
    const removedCost = averageCost * quantity;
    const netProceeds = tradeAmount - transaction.fees - transaction.taxes;
    current.quantity = round(current.quantity - quantity);
    current.totalCost = round(Math.max(0, current.totalCost - removedCost), 4);
    current.realizedPnl = round(current.realizedPnl + netProceeds - removedCost, 4);
    addCash(cash, transaction.accountId, transaction.currency, netProceeds);
    positions.set(key, current);
  }

  for (const balance of cash.values()) {
    const account = accounts.get(balance.accountId) as PortfolioAccount;
    if (balance.amount < -0.01 && !account.allowNegativeCash) {
      warnings.push(account.id + " มี cash ติดลบ " + balance.amount + " " + balance.currency);
    }
  }

  return {
    ledgerId: ledger.ledgerId,
    asOf: ledger.asOf,
    positions: [...positions.values()]
      .filter((position) => position.quantity > 0.00000001)
      .map((position) => ({
        ...position,
        quantity: round(position.quantity),
        totalCost: round(position.totalCost, 4),
        realizedPnl: round(position.realizedPnl, 4),
        averageCost: position.quantity > 0 ? round(position.totalCost / position.quantity, 4) : 0,
      }))
      .sort((left, right) => left.accountId.localeCompare(right.accountId) || left.securityId.localeCompare(right.securityId)),
    cash: [...cash.values()].sort((left, right) =>
      left.accountId.localeCompare(right.accountId) || left.currency.localeCompare(right.currency)
    ),
    warnings,
  };
}

export function validatePortfolioLedger(ledger: PortfolioLedger): string[] {
  const parsed = portfolioLedgerSchema.safeParse(ledger);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => "schema:" + (issue.path.join(".") || "root") + ":" + issue.message);
  }
  const problems: string[] = [];
  for (const duplicate of duplicateIds(ledger.accounts)) problems.push("account id ซ้ำ: " + duplicate);
  for (const duplicate of duplicateIds(ledger.transactions)) problems.push("transaction id ซ้ำ: " + duplicate);
  const accountIds = new Set(ledger.accounts.map((account) => account.id));
  for (const transaction of ledger.transactions) {
    if (!accountIds.has(transaction.accountId)) problems.push(transaction.id + " อ้าง accountId ที่ไม่มี");
    problems.push(...transactionProblems(transaction));
  }
  const sorted = sortedTransactions(ledger.transactions);
  if (sorted.some((transaction, index) => transaction.id !== ledger.transactions[index]?.id)) {
    problems.push("transactions ต้องเรียงตาม occurredAt และ id");
  }
  const expectedHash = portfolioLedgerContentHash(ledger);
  if (ledger.contentHash !== expectedHash) problems.push("contentHash ไม่ตรงกับ ledger");
  if (ledger.ledgerId !== "portfolio_" + expectedHash.slice(0, 24)) problems.push("ledgerId ไม่ตรงกับ contentHash");
  try {
    reconcilePortfolioLedger(ledger);
  } catch (error) {
    problems.push((error as Error).message);
  }
  return [...new Set(problems)];
}
