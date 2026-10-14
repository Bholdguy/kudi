import { describe, expect, it } from "vitest";
import { DEFAULT_NETWORK, NETWORKS, parseNetwork } from "@/lib/chains";
import { config, explorerAddressUrl, explorerTxUrl } from "@/lib/config";

describe("network registry", () => {
  it("keeps the Monad testnet values unchanged", () => {
    expect(NETWORKS.monad.chain.id).toBe(10143);
    expect(NETWORKS.monad.label).toBe("Monad testnet");
    expect(NETWORKS.monad.token).toEqual({
      symbol: "AUSD",
      address: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
    });
    expect(NETWORKS.monad.explorerBaseUrl).toBe("https://testnet.monadscan.com");
    expect(NETWORKS.monad.payMethod).toEqual({ kind: "erc20Transfer" });
    expect(DEFAULT_NETWORK).toBe("monad");
  });

  it("defines Arc mainnet with native USDC and the KudiPay contract", () => {
    expect(NETWORKS.arc.chain.id).toBe(5042);
    expect(NETWORKS.arc.chain.nativeCurrency).toEqual({ name: "USDC", symbol: "USDC", decimals: 18 });
    expect(NETWORKS.arc.label).toBe("Arc mainnet · real USDC");
    expect(NETWORKS.arc.rpcUrls).toEqual(["https://rpc.mainnet.arc.io"]);
    expect(NETWORKS.arc.explorerBaseUrl).toBe("https://explorer.arc.io");
    expect(NETWORKS.arc.payMethod).toEqual({
      kind: "kudiPay",
      contract: "0x9ff328491b91a25cfbf6eC9a9e6a6B148476b91F",
      feeFloorGwei: 20,
    });
  });

  it("reads a missing or unknown chain param as Monad", () => {
    expect(parseNetwork(null)).toBe("monad");
    expect(parseNetwork("monad")).toBe("monad");
    expect(parseNetwork("base")).toBe("monad");
    expect(parseNetwork("")).toBe("monad");
    expect(parseNetwork("arc")).toBe("arc");
  });

  it("keeps the config values Monad code reads", () => {
    expect(config.chain.id).toBe(NETWORKS.monad.chain.id);
    expect(config.ausdAddress).toBe(NETWORKS.monad.token.address);
    expect(config.rpcUrls).toEqual(NETWORKS.monad.rpcUrls);
  });

  it("builds explorer links per network, with Monad as the default", () => {
    const hash = "0x" + "1".repeat(64);
    expect(explorerTxUrl(hash)).toBe(`https://testnet.monadscan.com/tx/${hash}`);
    expect(explorerTxUrl(hash, "arc")).toBe(`https://explorer.arc.io/tx/${hash}`);
    expect(explorerAddressUrl("0x9ff328491b91a25cfbf6eC9a9e6a6B148476b91F", "arc")).toBe(
      "https://explorer.arc.io/address/0x9ff328491b91a25cfbf6eC9a9e6a6B148476b91F",
    );
  });
});
