import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { checkPayment, type PayInputs } from "@/lib/payment";
import { hasErrorCode, isRequestAlreadyPending, isUserRejection } from "@/lib/wallet";

const AMOUNT = 50_000_000n;
const ready: PayInputs = {
  hasProvider: true,
  account: "0x87Ceb46d1d9Ee0BfE16C5b0277Bb172b8fb46e84",
  chainId: config.chain.id,
  ausd: 20_000_000_000n,
  mon: 4_000_000_000_000_000_000n,
  amount: AMOUNT,
};

describe("KUDI-11 / E4 / E5 what the pay button does first", () => {
  it("E4: no wallet in the browser", () => {
    expect(checkPayment({ ...ready, hasProvider: false, account: null }).action).toBe("no_wallet");
  });

  it("KUDI-11: not connected yet", () => {
    expect(checkPayment({ ...ready, account: null, chainId: null }).action).toBe("not_connected");
  });

  it("E5: wrong network blocks payment, whatever the balances are", () => {
    expect(checkPayment({ ...ready, chainId: 1 }).action).toBe("wrong_chain");
    expect(checkPayment({ ...ready, chainId: 1, ausd: 0n, mon: 0n }).action).toBe("wrong_chain");
  });

  it("uses the configured chain id, not a literal", () => {
    expect(config.chain.id).toBe(10143);
    expect(checkPayment({ ...ready, chainId: config.chain.id }).action).toBe("ready");
  });
});

describe("KUDI-12 balance checks before paying", () => {
  it("waits while balances are unknown", () => {
    expect(checkPayment({ ...ready, ausd: null }).action).toBe("checking");
    expect(checkPayment({ ...ready, mon: null }).action).toBe("checking");
  });

  it("E6: AUSD below the invoice amount disables the button", () => {
    const check = checkPayment({ ...ready, ausd: AMOUNT - 1n });
    expect(check.action).toBe("low_ausd");
    expect(check.lowAusd).toBe(true);
  });

  it("an AUSD balance equal to the amount is enough", () => {
    expect(checkPayment({ ...ready, ausd: AMOUNT }).action).toBe("ready");
  });

  it("E7: zero MON disables the button", () => {
    const check = checkPayment({ ...ready, mon: 0n });
    expect(check.action).toBe("low_mon");
    expect(check.lowMon).toBe(true);
  });

  it("when both are short, AUSD is reported first and MON is still flagged", () => {
    const check = checkPayment({ ...ready, ausd: 0n, mon: 0n });
    expect(check.action).toBe("low_ausd");
    expect(check.lowMon).toBe(true);
  });

  it("KUDI-13: ready when connected, on the right network, with both balances", () => {
    expect(checkPayment(ready)).toEqual({ action: "ready", lowAusd: false, lowMon: false });
  });
});

describe("E9 / KUDI-13 errors are told apart by code, never by message", () => {
  it("recognises 4001 on the error itself", () => {
    expect(isUserRejection({ code: 4001 })).toBe(true);
  });

  it("recognises 4001 nested several levels deep", () => {
    const wrapped = { name: "ContractFunctionExecutionError", cause: { cause: { code: 4001 } } };
    expect(isUserRejection(wrapped)).toBe(true);
  });

  it("recognises viem's own rejection error", () => {
    expect(isUserRejection(new UserRejectedRequestError(new Error("anything")))).toBe(true);
  });

  it("does not treat a rejection-sounding message as a rejection", () => {
    expect(isUserRejection(new Error("User rejected the request"))).toBe(false);
    expect(isUserRejection({ code: 4100, message: "user rejected" })).toBe(false);
  });

  it("other failures are not rejections", () => {
    expect(isUserRejection(new Error("execution reverted"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
    expect(isUserRejection("4001")).toBe(false);
  });

  it("KUDI-11: finds 4902 (unknown network) at the top or in data.originalError", () => {
    expect(hasErrorCode({ code: 4902 }, 4902)).toBe(true);
    expect(hasErrorCode({ code: -32603, data: { originalError: { code: 4902 } } }, 4902)).toBe(true);
    expect(hasErrorCode({ code: 4001 }, 4902)).toBe(false);
  });

  it("recognises a request that is already waiting in the wallet", () => {
    expect(isRequestAlreadyPending({ code: -32002 })).toBe(true);
    expect(isRequestAlreadyPending({ code: 4001 })).toBe(false);
  });

  it("survives a cyclic cause chain", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isUserRejection(loop)).toBe(false);
  });
});
