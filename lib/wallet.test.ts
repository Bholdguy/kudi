import { beforeEach, describe, expect, it, vi } from "vitest";

const waitForTransactionReceipt = vi.fn();

vi.mock("@/lib/client", () => ({
  publicClient: { waitForTransactionReceipt: (...args: unknown[]) => waitForTransactionReceipt(...args) },
}));

import { config } from "@/lib/config";
import { waitForPayment } from "@/lib/wallet";

const HASH = "0x7ec422f8c5fdbbe84a82b85bf533769bc1106071f5f276f116443c8021f6b01e";

describe("KUDI-13 / E10 what the receipt says", () => {
  beforeEach(() => {
    waitForTransactionReceipt.mockReset();
  });

  it("a successful receipt is success", async () => {
    waitForTransactionReceipt.mockResolvedValue({ status: "success" });
    await expect(waitForPayment(HASH)).resolves.toBe("success");
  });

  it("E10: a reverted receipt is reverted, so the page says nothing was sent and offers a retry", async () => {
    waitForTransactionReceipt.mockResolvedValue({ status: "reverted" });
    await expect(waitForPayment(HASH)).resolves.toBe("reverted");
  });

  it("an unconfirmed transaction throws, so the page offers Check again and never a second payment", async () => {
    waitForTransactionReceipt.mockRejectedValue(new Error("timed out"));
    await expect(waitForPayment(HASH)).rejects.toThrow();
  });

  it("waits with the configured polling interval and timeout", async () => {
    waitForTransactionReceipt.mockResolvedValue({ status: "success" });
    await waitForPayment(HASH);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: HASH,
      pollingInterval: config.receiptPollMs,
      timeout: config.receiptTimeoutMs,
    });
  });
});
