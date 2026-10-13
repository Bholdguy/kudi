import { monadTestnet } from "viem/chains";
import type { Address } from "viem";

const DEFAULT_RPC_URL = "https://testnet-rpc.monad.xyz";

const primaryRpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL;
const fallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_URL_FALLBACK?.trim() || "";

// A fallback identical to the primary is no fallback, so it is dropped.
const rpcUrls: readonly string[] =
  fallbackRpcUrl && fallbackRpcUrl !== primaryRpcUrl
    ? [primaryRpcUrl, fallbackRpcUrl]
    : [primaryRpcUrl];

const passkeyRpId = process.env.NEXT_PUBLIC_PASSKEY_RP_ID?.trim() || "localhost";

const explorerBaseUrl ="https://testnet.monadscan.com";

export const config = {
  chain: {
    ...monadTestnet,
    blockExplorers: {
      default: { name: "Monadscan", url: explorerBaseUrl },
    },
  },
  rpcUrls,
  rpcRetryCount: 3,
  rpcRetryDelayMs: 150,
  ausdAddress: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC" as Address,
  faucetAddress: "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as Address,
  explorerBaseUrl,
  passkeyRpId,
  appName: "Kudi",
  storageKey: "kudi:v1",
  sessionKey: "kudi:session",
  displayNameMaxLength: 40,
  balanceRefreshMs: 5000,
  amountFractionDigits: 2,
  invoiceMaxWholeAmount: 1_000_000,
  memoMaxLength: 80,
  linkVersion: "1",
  invoiceIdPrefix: "inv_",
  invoiceIdRandomLength: 6,
  receiptPollMs: 500,
  receiptTimeoutMs: 60_000,
  monFaucetUrl: "https://faucet.monad.xyz",
  logMaxBlocks: 100,
  scanConcurrency: 6,
  scanMaxWindowsPerPass: 200,
  scanPollMs: 1500,
} as const;

export function explorerAddressUrl(address: Address): string {
  return `${config.explorerBaseUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${config.explorerBaseUrl}/tx/${hash}`;
}
