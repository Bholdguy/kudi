import { describe, expect, it } from "vitest";
import { defaultNetwork, receivedFromPaidInvoices, sumKnown } from "@/lib/assets";
import type { StoredInvoice } from "@/lib/store";

function invoice(patch: Partial<StoredInvoice> & { id: string }): StoredInvoice {
  return {
    network: "monad",
    salt: null,
    clientIndex: 1,
    amount: "1000000",
    memo: "",
    createdBlock: 1,
    createdAt: 1,
    status: "unpaid",
    paidTx: null,
    paidAmount: null,
    paidAt: null,
    ...patch,
  };
}

describe("received from paid invoices", () => {
  const invoices = [
    invoice({ id: "a", status: "paid", amount: "50000000", paidAmount: "50000000", paidAt: 100 }),
    invoice({ id: "b", status: "paid", amount: "10000000", paidAmount: "12000000", paidAt: 200 }),
    invoice({ id: "c", status: "unpaid", amount: "99000000" }),
    invoice({ id: "d", status: "underpaid", amount: "5000000", paidAmount: "2000000" }),
    invoice({ id: "e", network: "arc", status: "paid", amount: "50000", paidAmount: "50000", paidAt: 300 }),
  ];

  it("sums only paid invoices on the asked network, using what was received", () => {
    expect(receivedFromPaidInvoices(invoices, "monad")).toBe(62_000_000n);
    expect(receivedFromPaidInvoices(invoices, "arc")).toBe(50_000n);
  });

  it("is zero when nothing on that network is paid", () => {
    expect(receivedFromPaidInvoices([invoice({ id: "x" })], "monad")).toBe(0n);
    expect(receivedFromPaidInvoices([], "arc")).toBe(0n);
  });
});

describe("default network", () => {
  it("picks the network of the most recent paid invoice", () => {
    const invoices = [
      invoice({ id: "m", status: "paid", paidAt: 100 }),
      invoice({ id: "a", network: "arc", status: "paid", paidAt: 200 }),
    ];
    expect(defaultNetwork(invoices)).toBe("arc");
    expect(defaultNetwork([...invoices].reverse())).toBe("arc");
  });

  it("ignores unpaid invoices", () => {
    expect(defaultNetwork([invoice({ id: "a", network: "arc", paidAt: 999 })])).toBe("monad");
  });

  it("falls back to Monad when nothing is paid", () => {
    expect(defaultNetwork([])).toBe("monad");
    expect(defaultNetwork([invoice({ id: "a", network: "arc" })])).toBe("monad");
  });
});

describe("sumKnown", () => {
  it("adds known values", () => {
    expect(sumKnown([1n, 2n, 3n])).toBe(6n);
    expect(sumKnown([])).toBe(0n);
  });

  it("is null while any value is unknown", () => {
    expect(sumKnown([1n, undefined])).toBeNull();
  });
});
