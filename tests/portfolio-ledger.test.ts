import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPortfolioLedger,
  reconcilePortfolioLedger,
  validatePortfolioLedger,
  type PortfolioAccount,
  type PortfolioTransaction,
} from "../src/lib/portfolio/portfolio-ledger";
import { loadPortfolioLedger, savePortfolioLedger } from "../src/lib/portfolio/portfolio-ledger-store";

const temporaryRoots: string[] = [];
const account: PortfolioAccount = {
  id: "broker_main",
  name: "Main Brokerage",
  type: "brokerage",
  baseCurrency: "USD",
  country: "US",
  allowNegativeCash: false,
};

function transaction(
  id: string,
  type: PortfolioTransaction["type"],
  overrides: Partial<PortfolioTransaction> = {},
): PortfolioTransaction {
  return {
    id,
    accountId: account.id,
    occurredAt: "2026-01-01T00:00:00.000Z",
    type,
    securityId: null,
    currency: "USD",
    quantity: null,
    unitPrice: null,
    amount: null,
    splitRatio: null,
    fees: 0,
    taxes: 0,
    source: "user",
    externalRef: null,
    note: null,
    createdAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function transactions(): PortfolioTransaction[] {
  return [
    transaction("t1", "opening_cash", { amount: 100_000 }),
    transaction("t2", "buy", {
      occurredAt: "2026-02-01T00:00:00.000Z",
      securityId: "NASDAQ:TEST",
      quantity: 10,
      unitPrice: 100,
      fees: 5,
    }),
    transaction("t3", "dividend", {
      occurredAt: "2026-03-01T00:00:00.000Z",
      securityId: "NASDAQ:TEST",
      amount: 50,
    }),
    transaction("t4", "split", {
      occurredAt: "2026-04-01T00:00:00.000Z",
      securityId: "NASDAQ:TEST",
      splitRatio: 2,
      source: "system_corporate_action",
    }),
    transaction("t5", "sell", {
      occurredAt: "2026-05-01T00:00:00.000Z",
      securityId: "NASDAQ:TEST",
      quantity: 5,
      unitPrice: 60,
      fees: 2,
    }),
  ];
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("canonical portfolio ledger", () => {
  it("reconcile units, cost basis, realized PnL และ cash แบบ deterministic", () => {
    const ledger = createPortfolioLedger({
      profileId: "profile_fixture",
      asOf: "2026-08-09T00:00:00.000Z",
      accounts: [account],
      transactions: transactions().reverse(),
    }, "2026-08-09T00:00:00.000Z");
    const result = reconcilePortfolioLedger(ledger);
    expect(validatePortfolioLedger(ledger)).toEqual([]);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      securityId: "NASDAQ:TEST",
      quantity: 15,
      totalCost: 753.75,
      averageCost: 50.25,
      realizedPnl: 46.75,
    });
    expect(result.cash[0].amount).toBe(99_343);
    expect(result.warnings).toEqual([]);
  });

  it("content identity ไม่ขึ้นกับลำดับ input หรือเวลาสร้าง", () => {
    const draft = {
      profileId: "profile_fixture",
      asOf: "2026-08-09T00:00:00.000Z",
      accounts: [account],
      transactions: transactions(),
    };
    const first = createPortfolioLedger(draft, "2026-08-09T00:00:00.000Z");
    const second = createPortfolioLedger({ ...draft, transactions: [...draft.transactions].reverse() }, "2026-08-10T00:00:00.000Z");
    expect(first.ledgerId).toBe(second.ledgerId);
    expect(first.contentHash).toBe(second.contentHash);
  });

  it("ไม่ยอมให้ขายเกิน position หรืออ้าง account ที่ไม่มี", () => {
    const oversell = [
      transaction("t1", "opening_position", { securityId: "NASDAQ:TEST", quantity: 1, unitPrice: 100 }),
      transaction("t2", "sell", {
        occurredAt: "2026-02-01T00:00:00.000Z",
        securityId: "NASDAQ:TEST",
        quantity: 2,
        unitPrice: 110,
      }),
    ];
    expect(() => createPortfolioLedger({
      profileId: "profile_fixture",
      asOf: "2026-08-09T00:00:00.000Z",
      accounts: [account],
      transactions: oversell,
    })).toThrow(/ขายเกินจำนวนที่มี/);

    const unknownAccount = [transaction("t1", "deposit", { accountId: "missing", amount: 100 })];
    expect(() => createPortfolioLedger({
      profileId: "profile_fixture",
      asOf: "2026-08-09T00:00:00.000Z",
      accounts: [account],
      transactions: unknownAccount,
    })).toThrow(/accountId ที่ไม่มี/);
  });

  it("บันทึกและโหลด ledger แบบ atomic", () => {
    const root = mkdtempSync(path.join(tmpdir(), "portfolio-ledger-"));
    temporaryRoots.push(root);
    const ledger = createPortfolioLedger({
      profileId: "profile_fixture",
      asOf: "2026-08-09T00:00:00.000Z",
      accounts: [account],
      transactions: transactions(),
    });
    savePortfolioLedger(ledger, root);
    expect(loadPortfolioLedger(ledger.profileId, root)).toEqual(ledger);
  });
});
