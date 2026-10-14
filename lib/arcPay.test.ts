import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  arcCostCeiling,
  arcFees,
  arcInvoiceId,
  arcNativeValue,
  arcRevertMessage,
  arcRevertName,
} from "@/lib/arcPay";

const FREELANCER = "0x00000000000000000000000000000000000000A2" as Address;
const SALT = ("0x" + "ab".repeat(32)) as Hex;
const GWEI = 1_000_000_000n;

describe("Arc amounts: stored 6 decimals to native 18 decimals", () => {
  it("scales by 10^12", () => {
    expect(arcNativeValue(50_000n)).toBe(50_000_000_000_000_000n); // 0.05 USDC
    expect(arcNativeValue(1_000_000n)).toBe(1_000_000_000_000_000_000n); // 1 USDC
    expect(arcNativeValue(10_000n)).toBe(10_000_000_000_000_000n); // 0.01 USDC
    expect(arcNativeValue(0n)).toBe(0n);
  });
});

describe("Arc invoice ID", () => {
  // Vector computed with cast: `cast call <KudiPay> "invoiceIdOf(address,uint256,bytes32)(bytes32)"`
  // with freelancer 0x...A2, value 5e16 (0.05 USDC native) and salt 0xab repeated.
  // It matches `cast keccak (cast abi-encode 'f(address,uint256,bytes32)' ...)` too.
  it("matches the contract's invoiceIdOf for a known vector", () => {
    expect(arcInvoiceId(FREELANCER, 50_000n, SALT)).toBe(
      "0x13598e3dc732dae02f9ecf9804da739d0166a59fbdd9aba25721f7df8aa1bb7c",
    );
  });

  it("changes with the amount, the freelancer and the salt", () => {
    const base = arcInvoiceId(FREELANCER, 50_000n, SALT);
    expect(arcInvoiceId(FREELANCER, 50_001n, SALT)).not.toBe(base);
    expect(arcInvoiceId("0x00000000000000000000000000000000000000A3" as Address, 50_000n, SALT)).not.toBe(base);
    expect(arcInvoiceId(FREELANCER, 50_000n, ("0x" + "cd".repeat(32)) as Hex)).not.toBe(base);
  });
});

describe("Arc fees", () => {
  it("never goes below the 25 gwei floor", () => {
    expect(arcFees(20n * GWEI).maxFeePerGas).toBe(25n * GWEI);
    expect(arcFees(null).maxFeePerGas).toBe(25n * GWEI);
  });

  it("uses a higher network estimate when there is one", () => {
    expect(arcFees(40n * GWEI).maxFeePerGas).toBe(40n * GWEI);
  });

  it("sets the priority fee to 1 gwei", () => {
    expect(arcFees(null).maxPriorityFeePerGas).toBe(1n * GWEI);
  });

  it("prices the worst case as value plus gas at the max fee", () => {
    expect(arcCostCeiling(50_000_000_000_000_000n, 100_000n, 25n * GWEI)).toBe(
      50_000_000_000_000_000n + 100_000n * 25n * GWEI,
    );
  });
});

describe("Arc revert reasons", () => {
  it("reads the KudiPay error name from a wrapped error", () => {
    const wrapped = { cause: { cause: { data: { errorName: "AlreadyPaid" } } } };
    expect(arcRevertName(wrapped)).toBe("AlreadyPaid");
    expect(arcRevertName({ errorName: "ZeroAmount" })).toBe("ZeroAmount");
  });

  it("returns null for errors without a KudiPay name", () => {
    expect(arcRevertName(new Error("boom"))).toBeNull();
    expect(arcRevertName(undefined)).toBeNull();
  });

  it("maps each KudiPay error to its message", () => {
    expect(arcRevertMessage("AlreadyPaid")).toMatch(/already been paid/);
    expect(arcRevertMessage("ZeroAmount")).toMatch(/more than zero/);
    expect(arcRevertMessage("ZeroAddress")).toMatch(/not valid/);
    expect(arcRevertMessage("TransferFailed")).toMatch(/refused/);
    expect(arcRevertMessage(null)).toMatch(/rejected by the network/);
  });
});
