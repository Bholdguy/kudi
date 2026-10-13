import { describe, expect, it } from "vitest";
import { formatAmount } from "@/lib/amount";

describe("NFR-08 amount formatting", () => {
  it("formats 0.01, 50 and 1,000,000 AUSD at 6 decimals", () => {
    expect(formatAmount(10_000n, 6)).toBe("0.01");
    expect(formatAmount(50_000_000n, 6)).toBe("50.00");
    expect(formatAmount(1_000_000_000_000n, 6)).toBe("1,000,000.00");
  });

  it("KUDI-06: zero shows as 0.00", () => {
    expect(formatAmount(0n, 6)).toBe("0.00");
  });

  it("truncates instead of rounding up", () => {
    expect(formatAmount(1_999_999n, 6)).toBe("1.99");
    expect(formatAmount(9_999n, 6)).toBe("0.00");
  });

  it("reads decimals from the argument, not a constant", () => {
    expect(formatAmount(150n, 2)).toBe("1.50");
    expect(formatAmount(5n, 0)).toBe("5.00");
    expect(formatAmount(1_500_000_000_000_000_000n, 18)).toBe("1.50");
  });
});
