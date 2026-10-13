import { describe, expect, it } from "vitest";
import { extraAmount, invoicesChanged, mergeTransfers, reconcileInvoices } from "@/lib/reconcile";
import type { StoredInvoice, StoredTransfer } from "@/lib/store";

const AUSD = (n: number): string => (BigInt(n) * 1_000_000n).toString();

function invoice(id: string, amountAusd: number, createdBlock: number, createdAt = createdBlock): StoredInvoice {
  return {
    id,
    clientIndex: 1,
    amount: AUSD(amountAusd),
    memo: "",
    createdBlock,
    createdAt,
    status: "unpaid",
    paidTx: null,
    paidAmount: null,
    paidAt: null,
  };
}

function transfer(valueAusd: number | string, block: number, logIndex = 0, tx = `0xtx${block}_${logIndex}`): StoredTransfer {
  const value = typeof valueAusd === "number" ? AUSD(valueAusd) : valueAusd;
  return { block, logIndex, tx, value, timestamp: 1_000_000 + block };
}

const byId = (list: StoredInvoice[], id: string): StoredInvoice => list.find((i) => i.id === id)!;

describe("KUDI-14 matching rule", () => {
  it("an exact transfer marks the invoice Paid with the transaction and time", () => {
    const result = reconcileInvoices([invoice("a", 50, 100)], [transfer(50, 105, 0, "0xpay")]);
    expect(result[0]).toMatchObject({
      status: "paid",
      paidTx: "0xpay",
      paidAmount: AUSD(50),
      paidAt: 1_000_105,
    });
  });

  it("the oldest unpaid invoice with the same amount is paid first", () => {
    const result = reconcileInvoices(
      [invoice("newer", 50, 200), invoice("older", 50, 100)],
      [transfer(50, 300)],
    );
    expect(byId(result, "older").status).toBe("paid");
    expect(byId(result, "newer").status).toBe("unpaid");
  });

  it("a second matching transfer pays the next invoice", () => {
    const result = reconcileInvoices(
      [invoice("a", 50, 100), invoice("b", 50, 110)],
      [transfer(50, 300), transfer(50, 310)],
    );
    expect(result.map((i) => i.status)).toEqual(["paid", "paid"]);
  });

  it("an exact amount beats age: a transfer of 20 pays the 20 invoice, not the older 50", () => {
    const result = reconcileInvoices(
      [invoice("big", 50, 100), invoice("small", 20, 110)],
      [transfer(20, 300)],
    );
    expect(byId(result, "small").status).toBe("paid");
    expect(byId(result, "big").status).toBe("unpaid");
  });

  it("ignores transfers from before the invoice was created", () => {
    const result = reconcileInvoices([invoice("a", 50, 100)], [transfer(50, 99)]);
    expect(result[0].status).toBe("unpaid");
  });

  it("counts a transfer in the very block the invoice was created", () => {
    const result = reconcileInvoices([invoice("a", 50, 100)], [transfer(50, 100)]);
    expect(result[0].status).toBe("paid");
  });

  it("gives back the same result when run again (idempotent)", () => {
    const invoices = [invoice("a", 50, 100), invoice("b", 30, 120)];
    const transfers = [transfer(50, 130), transfer(10, 140), transfer(30, 150)];
    const once = reconcileInvoices(invoices, transfers);
    expect(reconcileInvoices(once, transfers)).toEqual(once);
    expect(invoicesChanged(once, reconcileInvoices(once, transfers))).toBe(false);
  });
});

describe("E11 / E(b) short payments add up", () => {
  it("E11: less than the invoice marks it Underpaid and keeps the amount received", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer(30, 105)]);
    expect(result).toMatchObject({ status: "underpaid", paidAmount: AUSD(30) });
  });

  it("30 then 20 turns a 50 invoice Paid", () => {
    const [result] = reconcileInvoices(
      [invoice("a", 50, 100)],
      [transfer(30, 105), transfer(20, 110, 0, "0xtopup")],
    );
    expect(result).toMatchObject({ status: "paid", paidAmount: AUSD(50), paidTx: "0xtopup" });
    expect(extraAmount(result)).toBe(0n);
  });

  it("30 then 30 is Paid with 10 extra", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer(30, 105), transfer(30, 110)]);
    expect(result.status).toBe("paid");
    expect(extraAmount(result)).toBe(10_000_000n);
  });

  it("still Underpaid after two short payments that do not reach the amount", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer(10, 105), transfer(15, 110)]);
    expect(result).toMatchObject({ status: "underpaid", paidAmount: AUSD(25) });
  });

  it("a fractional shortfall is exact, with no floats", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer("49990000", 105)]);
    expect(result).toMatchObject({ status: "underpaid", paidAmount: "49990000" });
  });
});

describe("E12 overpayment", () => {
  it("more than the invoice marks it Paid and shows the extra", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer(70, 105)]);
    expect(result.status).toBe("paid");
    expect(extraAmount(result)).toBe(20_000_000n);
  });

  it("a faucet-sized transfer after the invoice is an overpayment, not ignored", () => {
    const [result] = reconcileInvoices([invoice("a", 50, 100)], [transfer(10_000, 105)]);
    expect(result.status).toBe("paid");
    expect(extraAmount(result)).toBe(9_950_000_000n);
  });
});

describe("E13 the same client pays twice", () => {
  it("the first transfer pays the invoice and the second matches nothing", () => {
    const [result] = reconcileInvoices(
      [invoice("a", 50, 100)],
      [transfer(50, 105, 0, "0xfirst"), transfer(50, 110, 0, "0xsecond")],
    );
    expect(result).toMatchObject({ status: "paid", paidTx: "0xfirst", paidAmount: AUSD(50) });
  });

  it("a transfer with no invoice open changes nothing", () => {
    expect(reconcileInvoices([], [transfer(50, 105)])).toEqual([]);
  });
});

describe("E18 log order", () => {
  it("sorts by block then log index, whatever order the RPC returned", () => {
    const invoices = [invoice("a", 50, 100)];
    const first = transfer(30, 105, 2, "0xearly");
    const second = transfer(20, 105, 7, "0xlate");
    const forward = reconcileInvoices(invoices, [first, second]);
    const shuffled = reconcileInvoices(invoices, [second, first]);
    expect(shuffled).toEqual(forward);
    expect(forward[0]).toMatchObject({ status: "paid", paidTx: "0xlate" });
  });

  it("the same log delivered twice counts once", () => {
    const t = transfer(50, 105, 3, "0xonce");
    const result = reconcileInvoices([invoice("a", 100, 100)], [t, t]);
    expect(result[0]).toMatchObject({ status: "underpaid", paidAmount: AUSD(50) });
  });

  it("merging cached and freshly found transfers drops duplicates", () => {
    const t = transfer(50, 105, 3, "0xonce");
    expect(mergeTransfers([t], [t, transfer(5, 106)])).toHaveLength(2);
  });
});

describe("keeps the order and fields of the invoices it is given", () => {
  it("returns invoices in the original order with other fields untouched", () => {
    const input = [invoice("z", 50, 200), invoice("y", 40, 100)];
    const result = reconcileInvoices(input, [transfer(40, 300)]);
    expect(result.map((i) => i.id)).toEqual(["z", "y"]);
    expect(result[0].memo).toBe(input[0].memo);
    expect(result[1].status).toBe("paid");
  });
});
