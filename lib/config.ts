import type { Address } from "viem";
import { NETWORKS, type NetworkKey } from "@/lib/chains";

const passkeyRpId = process.env.NEXT_PUBLIC_PASSKEY_RP_ID?.trim() || "localhost";

const monad = NETWORKS.monad;

export const config = {
  chain: monad.chain,
  rpcUrls: monad.rpcUrls,
  rpcRetryCount: 3,
  rpcRetryDelayMs: 150,
  ausdAddress: monad.token.address as Address,
  faucetAddress: "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as Address,
  explorerBaseUrl: monad.explorerBaseUrl,
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
  errorGraceFailures: 2,
  recoveryProbeCount: 20,
  recentActivityLimit: 10,
  recoveryTimeoutMs: 4000,
} as const;

export function explorerAddressUrl(address: Address, network: NetworkKey = "monad"): string {
  return `${NETWORKS[network].explorerBaseUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string, network: NetworkKey = "monad"): string {
  return `${NETWORKS[network].explorerBaseUrl}/tx/${hash}`;
}
