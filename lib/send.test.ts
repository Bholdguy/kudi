import { describe, expect, it } from "vitest";
import {
  gasCostWithMargin,
  maxSendable,
  parseSendAmount,
  classifySendError,
  sendAmountText,
  validateSend,
  type SendInput,
} from "@/lib/send";
import { withSecretBytes } from "@/lib/secretBytes";

const GWEI = 1_000_000_000n;
const FROM = "0x61Eae58F21AE29E172855c8c3debc0dACff53A44" as const;
const TO = "0xA586108FeA48130F1e9FAa634Dace29867629A39";
const GAS = 21_000n;
const FEE = 25n * GWEI;
const ONE_USDC = 10n ** 18n;

function input(patch: Partial<SendInput> = {}): SendInput {
  return {
    from: FROM,
    to: TO,
    amountText: "0.5",
    balance: 2n * ONE_USDC,
    gas: GAS,
    maxFeePerGas: FEE,
    ...patch,
  };
}

describe("parseSendAmount", () => {
  it("reads USDC with up to 6 decimals as native 18-decimal units", () => {
    expect(parseSendAmount("0.005")).toBe(5_000_000_000_000_000n);
    expect(parseSendAmount("1")).toBe(ONE_USDC);
    expect(parseSendAmount(" 2.5 ")).toBe(2_500_000_000_000_000_000n);
    expect(parseSendAmount("0.000001")).toBe(10n ** 12n);
  });

  it("rejects zero, empty, negative, too many decimals and non-numbers", () => {
    for (const bad of ["0", "0.00", "", "-1", "1.0000001", "abc", "1e3", ".5", "1,000"]) {
      expect(parseSendAmount(bad)).toBeNull();
    }
  });
});

describe("Max math", () => {
  it("prints an amount as text rounded down to 6 decimals", () => {
    expect(sendAmountText(5_000_000_000_000_000n)).toBe("0.005");
    expect(sendAmountText(ONE_USDC)).toBe("1");
    expect(sendAmountText(1_999_999_999_999_999_999n)).toBe("1.999999");
    expect(sendAmountText(0n)).toBe("0");
  });

  it("adds the margin to the gas cost", () => {
    // 21,000 gas at 25 gwei is 0.000525 USDC; with a 10% margin, 0.0005775 USDC.
    expect(gasCostWithMargin(GAS, FEE)).toBe(577_500_000_000_000n);
  });

  it("is the balance minus the margined gas cost", () => {
    expect(maxSendable(ONE_USDC, GAS, FEE)).toBe(ONE_USDC - 577_500_000_000_000n);
  });

  it("is zero when the balance does not cover gas", () => {
    expect(maxSendable(100n, GAS, FEE)).toBe(0n);
    expect(maxSendable(0n, GAS, FEE)).toBe(0n);
  });

  it("uses the 25 gwei floor by default", () => {
    expect(maxSendable(ONE_USDC, GAS)).toBe(maxSendable(ONE_USDC, GAS, FEE));
  });
});

describe("validateSend", () => {
  it("accepts a valid send and returns the checksummed recipient, value and fee", () => {
    const result = validateSend(input({ to: TO.toLowerCase() }));
    expect(result).toEqual({ ok: true, to: TO, value: 5n * 10n ** 17n, fee: GAS * FEE });
  });

  it("rejects a malformed address", () => {
    expect(validateSend(input({ to: "0x123" }))).toMatchObject({ ok: false, field: "to" });
    expect(validateSend(input({ to: "" }))).toMatchObject({ ok: false, field: "to" });
  });

  it("rejects a mixed-case address whose checksum is wrong", () => {
    const badChecksum = TO.replace("A586", "a586");
    expect(validateSend(input({ to: badChecksum }))).toMatchObject({ ok: false, field: "to" });
  });

  it("rejects the zero address", () => {
    expect(validateSend(input({ to: "0x0000000000000000000000000000000000000000" }))).toMatchObject({
      ok: false,
      field: "to",
    });
  });

  it("rejects sending to the from-address, in any case", () => {
    expect(validateSend(input({ to: FROM.toLowerCase() }))).toMatchObject({ ok: false, field: "to" });
    expect(validateSend(input({ to: FROM }))).toMatchObject({ ok: false, field: "to" });
  });

  it("rejects an amount that is zero or not a number", () => {
    expect(validateSend(input({ amountText: "0" }))).toMatchObject({ ok: false, field: "amount" });
    expect(validateSend(input({ amountText: "abc" }))).toMatchObject({ ok: false, field: "amount" });
  });

  it("accepts the Max amount, rounded down to 6 decimals, and rejects one above it", () => {
    const max = maxSendable(ONE_USDC, GAS, FEE);
    expect(validateSend(input({ balance: ONE_USDC, amountText: sendAmountText(max) }))).toMatchObject({ ok: true });
    expect(validateSend(input({ balance: ONE_USDC, amountText: "1" }))).toMatchObject({
      ok: false,
      field: "amount",
    });
  });

  it("rounds Max down so it never exceeds the balance", () => {
    const max = maxSendable(ONE_USDC, GAS, FEE);
    expect(parseSendAmount(sendAmountText(max))! <= max).toBe(true);
  });

  it("explains when the balance cannot cover the fee at all", () => {
    const result = validateSend(input({ balance: 100n, amountText: "0.01" }));
    expect(result).toMatchObject({ ok: false, field: "amount" });
    if (!result.ok) expect(result.message).toMatch(/cover the network fee/);
  });
});

describe("withSecretBytes", () => {
  it("zeroes the secret after a successful use", async () => {
    let seen: Uint8Array | undefined;
    const result = await withSecretBytes(
      () => new Uint8Array(32).fill(7),
      (secret) => {
        seen = secret;
        return secret[0] + 1;
      },
    );
    expect(result).toBe(8);
    expect(seen).toBeDefined();
    expect(Array.from(seen!).every((byte) => byte === 0)).toBe(true);
  });

  it("zeroes the secret even when the use throws", async () => {
    let seen: Uint8Array | undefined;
    await expect(
      withSecretBytes(
        () => new Uint8Array(32).fill(9),
        async (secret) => {
          seen = secret;
          throw new Error("broadcast failed");
        },
      ),
    ).rejects.toThrow("broadcast failed");
    expect(Array.from(seen!).every((byte) => byte === 0)).toBe(true);
  });

  it("zeroes an inner secret when the outer scope fails", async () => {
    let inner: Uint8Array | undefined;
    await expect(
      withSecretBytes(
        () => new Uint8Array(32).fill(1),
        (prf) =>
          withSecretBytes(
            () => {
              const key = new Uint8Array(32).fill(2);
              inner = key;
              return key;
            },
            () => {
              throw new Error("signing failed");
            },
          ).finally(() => prf.fill(0)),
      ),
    ).rejects.toThrow("signing failed");
    expect(Array.from(inner!).every((byte) => byte === 0)).toBe(true);
  });
});

describe("classifySendError", () => {
  it("sorts a node error into insufficient, refused or network", () => {
    expect(classifySendError(new Error("insufficient funds for gas * price + value"))).toBe("insufficient");
    expect(classifySendError({ cause: { shortMessage: "execution reverted" } })).toBe("refused");
    expect(classifySendError(new Error("fetch failed"))).toBe("network");
    expect(classifySendError(undefined)).toBe("network");
  });
});
