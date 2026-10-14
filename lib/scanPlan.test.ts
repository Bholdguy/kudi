import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { initialThrough, planScan, rewindThrough, settledThrough } from "@/lib/scanPlan";
import type { StoredInvoice } from "@/lib/store";

const MAX = config.logMaxBlocks;

function covered(plan: ReturnType<typeof planScan>): number[] {
  return plan.windows.flatMap((w) => Array.from({ length: w.to - w.from + 1 }, (_, i) => w.from + i));
}

function invoiceAt(id: string, createdBlock: number): StoredInvoice {
  return {
    id,
    clientIndex: 1,
    amount: "1",
    memo: "",
    createdBlock,
    createdAt: 0,
    network: "monad",
    salt: null,
    status: "unpaid",
    paidTx: null,
    paidAmount: null,
    paidAt: null,
  };
}

describe("NFR-03 scan windows stay inside the RPC's range limit", () => {
  it("the window size is within what both RPCs accept (101 blocks inclusive)", () => {
    expect(MAX).toBeGreaterThan(0);
    expect(MAX).toBeLessThanOrEqual(101);
  });

  it("nothing to scan when already at the head", () => {
    expect(planScan(1000, 1000)).toEqual({ windows: [], reachesHead: true, through: 1000 });
  });

  it("a normal 1.5 s poll (a few new blocks) is a single small window", () => {
    expect(planScan(1000, 1004)).toEqual({
      windows: [{ from: 1001, to: 1004 }],
      reachesHead: true,
      through: 1004,
    });
  });

  it("a gap of exactly the window size is one window; one more block is two", () => {
    expect(planScan(1000, 1000 + MAX).windows).toHaveLength(1);
    expect(planScan(1000, 1000 + MAX + 1).windows).toEqual([
      { from: 1001, to: 1000 + MAX },
      { from: 1001 + MAX, to: 1001 + MAX },
    ]);
  });

  it("the live poll falls back to many windows after the phone sleeps or the tab was hidden", () => {
    const through = 70_000_000;
    const head = through + 5_000;
    const plan = planScan(through, head);
    expect(plan.windows.length).toBeGreaterThan(1);
    expect(plan.windows.every((w) => w.to - w.from + 1 <= MAX)).toBe(true);
    expect(plan.reachesHead).toBe(true);
    expect(plan.through).toBe(head);
    const blocks = covered(plan);
    expect(blocks).toHaveLength(5_000);
    expect(blocks[0]).toBe(through + 1);
    expect(blocks[blocks.length - 1]).toBe(head);
    expect(blocks.every((b, i) => i === 0 || b === blocks[i - 1] + 1)).toBe(true);
  });

  it("a gap of ten minutes at Monad block times is covered without any oversized request", () => {
    const blocks = 10 * 60 * 3;
    const plan = planScan(100, 100 + blocks);
    expect(plan.windows.every((w) => w.to - w.from + 1 <= MAX)).toBe(true);
    expect(covered(plan)).toHaveLength(blocks);
  });

  it("a very long gap is capped per pass and picks up where it stopped", () => {
    const first = planScan(0, 1_000_000, MAX, 3);
    expect(first.windows).toHaveLength(3);
    expect(first.reachesHead).toBe(false);
    expect(first.through).toBe(3 * MAX);
    const second = planScan(first.through, 1_000_000, MAX, 3);
    expect(second.windows[0].from).toBe(first.through + 1);
  });

  it("a head that is behind the recorded mark (a lagging RPC) scans nothing and keeps the mark", () => {
    expect(planScan(1000, 990)).toEqual({ windows: [], reachesHead: true, through: 1000 });
  });
});

describe("E17 where a scan starts and where it is recorded as finished", () => {
  it("a first scan starts just before the oldest invoice's block", () => {
    expect(initialThrough([invoiceAt("a", 500), invoiceAt("b", 300)])).toBe(299);
  });

  it("an invoice created during a pass keeps the mark behind its own block", () => {
    const atStart = new Set(["a"]);
    const now = [invoiceAt("a", 100), invoiceAt("new", 1_050)];
    expect(settledThrough(1_060, atStart, now)).toBe(1_049);
  });

  it("invoices that were already known do not hold the mark back", () => {
    expect(settledThrough(1_060, new Set(["a"]), [invoiceAt("a", 100)])).toBe(1_060);
  });

  it("creating an invoice rewinds an already-scanned mark to just before its block", () => {
    expect(rewindThrough(2_000, 2_000)).toBe(1_999);
    expect(rewindThrough(2_000, 1_990)).toBe(1_989);
  });

  it("creating an invoice never moves the mark forward", () => {
    expect(rewindThrough(2_000, 5_000)).toBe(2_000);
  });
});
