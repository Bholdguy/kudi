import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount } from "@/lib/amount";
import {
  buildInvoice,
  buildPayLink,
  generateInvoiceId,
  generateSalt,
  isMonadInvoice,
  parsePayLink,
  type PayLink,
} from "@/lib/invoice";

const TO = "0xA586108FeA48130F1e9FAa634Dace29867629A39";
const ORIGIN = "https://kudi-bholdguy.vercel.app";

const base: PayLink = {
  to: TO,
  amt: 50_000_000n,
  inv: "inv_abc234",
  n: "Ada Okafor",
  c: "Acme GmbH",
  m: "October design work",
  b: 123456,
  network: "monad",
  salt: null,
};

function queryOf(link: string): URLSearchParams {
  return new URL(link).searchParams;
}

describe("NFR-08 amount parsing", () => {
  it("0.01, 50 and 1,000,000 AUSD round-trip at 6 decimals", () => {
    for (const [text, units] of [
      ["0.01", 10_000n],
      ["50", 50_000_000n],
      ["1000000", 1_000_000_000_000n],
    ] as const) {
      const parsed = parseAmount(text, 6);
      expect(parsed).toEqual({ ok: true, units });
      expect(parseAmount(formatAmount(units, 6).replace(/,/g, ""), 6)).toEqual({ ok: true, units });
    }
  });

  it("KUDI-07: accepts up to 2 decimals and rejects the rest", () => {
    expect(parseAmount("50.5", 6)).toEqual({ ok: true, units: 50_500_000n });
    expect(parseAmount("50.25", 6)).toEqual({ ok: true, units: 50_250_000n });
    expect(parseAmount("1.005", 6)).toEqual({ ok: false, reason: "too_many_decimals" });
    expect(parseAmount("0", 6)).toEqual({ ok: false, reason: "too_small" });
    expect(parseAmount("0.00", 6)).toEqual({ ok: false, reason: "too_small" });
    expect(parseAmount("1000000.01", 6)).toEqual({ ok: false, reason: "too_large" });
    expect(parseAmount("", 6)).toEqual({ ok: false, reason: "empty" });
    for (const bad of ["abc", "-5", "1e3", ".5", "5.", "1,000", "5 0"]) {
      expect(parseAmount(bad, 6)).toEqual({ ok: false, reason: "format" });
    }
  });

  it("reads decimals from the argument", () => {
    expect(parseAmount("1.5", 18)).toEqual({ ok: true, units: 1_500_000_000_000_000_000n });
  });
});

describe("KUDI-07 invoice building", () => {
  it("makes an unpaid invoice with the recorded block and a valid id", () => {
    const id = generateInvoiceId();
    expect(id).toMatch(/^inv_[a-z2-9]{6}$/);
    const invoice = buildInvoice({
      id,
      client: { index: 1, name: "Acme GmbH", address: TO, createdAt: 1 },
      amount: 50_000_000n,
      memo: "October design work",
      createdBlock: 123456,
      nowSeconds: 1_760_300_000,
      network: "monad",
      salt: null,
    });
    expect(invoice).toMatchObject({
      clientIndex: 1,
      amount: "50000000",
      createdBlock: 123456,
      status: "unpaid",
      paidTx: null,
      paidAmount: null,
    });
  });

  it("generates different ids", () => {
    expect(new Set(Array.from({ length: 50 }, generateInvoiceId)).size).toBe(50);
  });
});

describe("KUDI-08 pay link round trip", () => {
  it("decodes every field it encoded", () => {
    const link = buildPayLink(ORIGIN, base);
    expect(link.startsWith(`${ORIGIN}/pay?v=1&to=${TO}&amt=50000000&inv=inv_abc234`)).toBe(true);
    expect(parsePayLink(queryOf(link))).toEqual({ ok: true, link: base });
  });

  it("survives unicode, spaces and reserved characters in names and memo", () => {
    const tricky: PayLink = {
      ...base,
      n: "Ada & Sons = 100% (Lagos) #1",
      c: "Müller GmbH 🚀",
      m: "Line? yes/no & more=ok+plus %20",
    };
    expect(parsePayLink(queryOf(buildPayLink(ORIGIN, tricky)))).toEqual({ ok: true, link: tricky });
  });

  it("leaves out empty optional fields and still decodes them as empty", () => {
    const link = buildPayLink(ORIGIN, { ...base, c: "", m: "" });
    expect(link).not.toContain("&c=");
    expect(link).not.toContain("&m=");
    const parsed = parsePayLink(queryOf(link));
    expect(parsed).toEqual({ ok: true, link: { ...base, c: "", m: "" } });
  });

  it("ignores an extra sig parameter", () => {
    const params = queryOf(buildPayLink(ORIGIN, base));
    params.set("sig", "0xdeadbeef");
    expect(parsePayLink(params).ok).toBe(true);
  });
});

describe("KUDI-10 / E14 broken links", () => {
  function mutate(change: (p: URLSearchParams) => void): boolean {
    const params = queryOf(buildPayLink(ORIGIN, base));
    change(params);
    return parsePayLink(params).ok;
  }

  it("rejects a tampered or malformed address", () => {
    expect(mutate((p) => p.set("to", "0x123"))).toBe(false);
    expect(mutate((p) => p.set("to", TO.slice(0, 41) + "g"))).toBe(false);
    expect(mutate((p) => p.delete("to"))).toBe(false);
    // Mixed case with a wrong checksum.
    expect(mutate((p) => p.set("to", TO.replace("A586", "a586")))).toBe(false);
  });

  it("rejects a missing or non-positive-integer amount", () => {
    for (const bad of ["0", "-5", "1.5", "abc", "", "007", "1e6"]) {
      expect(mutate((p) => p.set("amt", bad))).toBe(false);
    }
    expect(mutate((p) => p.delete("amt"))).toBe(false);
    expect(mutate((p) => p.set("amt", "9".repeat(80)))).toBe(false);
  });

  it("rejects a wrong version, bad id, bad block and missing name", () => {
    expect(mutate((p) => p.set("v", "2"))).toBe(false);
    expect(mutate((p) => p.delete("v"))).toBe(false);
    expect(mutate((p) => p.set("inv", "abc"))).toBe(false);
    expect(mutate((p) => p.set("inv", "x".repeat(17)))).toBe(false);
    expect(mutate((p) => p.set("inv", "inv abc 1"))).toBe(false);
    expect(mutate((p) => p.set("b", "-1"))).toBe(false);
    expect(mutate((p) => p.set("b", "12.5"))).toBe(false);
    expect(mutate((p) => p.delete("b"))).toBe(false);
    expect(mutate((p) => p.delete("n"))).toBe(false);
    expect(mutate((p) => p.set("n", "   "))).toBe(false);
  });

  it("rejects over-long fields and control characters", () => {
    expect(mutate((p) => p.set("n", "x".repeat(41)))).toBe(false);
    expect(mutate((p) => p.set("c", "x".repeat(41)))).toBe(false);
    expect(mutate((p) => p.set("m", "x".repeat(81)))).toBe(false);
    expect(mutate((p) => p.set("m", "x".repeat(80)))).toBe(true);
    expect(mutate((p) => p.set("m", "bad\u0000text"))).toBe(false);
  });

  it("rejects an empty query", () => {
    expect(parsePayLink("").ok).toBe(false);
  });
});

describe("Arc networks: chain and salt on pay links", () => {
  const ARC_SALT = "0x" + "ab".repeat(32);
  const arc: PayLink = { ...base, network: "arc", salt: ARC_SALT };

  it("writes chain=monad for Monad links and chain=arc with the salt for Arc links", () => {
    expect(queryOf(buildPayLink(ORIGIN, base)).get("chain")).toBe("monad");
    const params = queryOf(buildPayLink(ORIGIN, arc));
    expect(params.get("chain")).toBe("arc");
    expect(params.get("s")).toBe(ARC_SALT);
  });

  it("round-trips an Arc link with its salt", () => {
    expect(parsePayLink(queryOf(buildPayLink(ORIGIN, arc)))).toEqual({ ok: true, link: arc });
  });

  it("an old Monad link with no chain param still parses as Monad", () => {
    const params = queryOf(buildPayLink(ORIGIN, base));
    params.delete("chain");
    expect(parsePayLink(params)).toEqual({ ok: true, link: base });
  });

  it("an unknown chain value falls back to Monad", () => {
    const params = queryOf(buildPayLink(ORIGIN, base));
    params.set("chain", "base");
    expect(parsePayLink(params)).toEqual({ ok: true, link: base });
  });

  it("rejects an Arc link without a well-formed 32-byte salt", () => {
    const withSalt = (value: string | null) => {
      const params = queryOf(buildPayLink(ORIGIN, arc));
      if (value === null) params.delete("s");
      else params.set("s", value);
      return parsePayLink(params).ok;
    };
    expect(withSalt(null)).toBe(false);
    expect(withSalt("0x1234")).toBe(false);
    expect(withSalt("ab".repeat(32))).toBe(false);
    expect(withSalt("0x" + "zz".repeat(32))).toBe(false);
    expect(withSalt(ARC_SALT)).toBe(true);
  });

  it("generates 32-byte salts that differ", () => {
    const salts = new Set(Array.from({ length: 20 }, generateSalt));
    expect(salts.size).toBe(20);
    for (const salt of salts) expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("only Monad invoices are matched against AUSD transfers", () => {
    const invoice = buildInvoice({
      id: "inv_abc234",
      client: { index: 1, name: "Acme", address: TO, createdAt: 1 },
      amount: 10_000n,
      memo: "",
      createdBlock: 1,
      nowSeconds: 1,
      network: "arc",
      salt: ARC_SALT,
    });
    expect(isMonadInvoice(invoice)).toBe(false);
    expect(isMonadInvoice({ ...invoice, network: "monad", salt: null })).toBe(true);
  });
});
