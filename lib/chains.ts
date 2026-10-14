import { defineChain, type Address, type Chain } from "viem";
import { monadTestnet } from "viem/chains";

/** The networks a Kudi invoice can be on. A missing or unknown value means "monad". */
export type NetworkKey = "monad" | "arc";

export type PayMethod =
  | { kind: "erc20Transfer" }
  | { kind: "kudiPay"; contract: Address; feeFloorGwei: number };

export type NetworkEntry = {
  key: NetworkKey;
  /** Badge text shown to both freelancer and client. */
  label: string;
  chain: Chain;
  rpcUrls: readonly string[];
  explorerBaseUrl: string;
  /** The token as seen through its ERC-20 interface. Its decimals are read from the contract. */
  token: { symbol: string; address: Address };
  payMethod: PayMethod;
};

const DEFAULT_MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
const ARC_RPC_URL = "https://rpc.mainnet.arc.io";
const ARC_EXPLORER_URL = "https://explorer.arc.io";
const MONAD_EXPLORER_URL = "https://testnet.monadscan.com";

const monadPrimaryRpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_MONAD_RPC_URL;
const monadFallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_URL_FALLBACK?.trim() || "";

// A fallback identical to the primary is no fallback, so it is dropped.
const monadRpcUrls: readonly string[] =
  monadFallbackRpcUrl && monadFallbackRpcUrl !== monadPrimaryRpcUrl
    ? [monadPrimaryRpcUrl, monadFallbackRpcUrl]
    : [monadPrimaryRpcUrl];

const arcChain = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_EXPLORER_URL } },
});

export const NETWORKS: Record<NetworkKey, NetworkEntry> = {
  monad: {
    key: "monad",
    label: "Monad testnet",
    chain: {
      ...monadTestnet,
      blockExplorers: {
        default: { name: "Monadscan", url: MONAD_EXPLORER_URL },
      },
    },
    rpcUrls: monadRpcUrls,
    explorerBaseUrl: MONAD_EXPLORER_URL,
    token: {
      symbol: "AUSD",
      address: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
    },
    payMethod: { kind: "erc20Transfer" },
  },
  arc: {
    key: "arc",
    label: "Arc mainnet · real USDC",
    chain: arcChain,
    rpcUrls: [ARC_RPC_URL],
    explorerBaseUrl: ARC_EXPLORER_URL,
    token: {
      symbol: "USDC",
      address: "0x3600000000000000000000000000000000000000",
    },
    payMethod: {
      kind: "kudiPay",
      contract: "0x9ff328491b91a25cfbf6eC9a9e6a6B148476b91F",
      feeFloorGwei: 20,
    },
  },
};

export const DEFAULT_NETWORK: NetworkKey = "monad";

/** Reads a `chain` value. Anything other than "arc" is Monad, so old links keep working. */
export function parseNetwork(value: string | null): NetworkKey {
  return value === "arc" ? "arc" : DEFAULT_NETWORK;
}
