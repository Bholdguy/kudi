import {
  createWalletClient,
  custom,
  erc20Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { config } from "@/lib/config";
import { publicClient } from "@/lib/client";

const USER_REJECTED = 4001;
const UNRECOGNIZED_CHAIN = 4902;
const REQUEST_ALREADY_PENDING = -32002;
const MAX_CAUSE_DEPTH = 10;

export type WalletProvider = EIP1193Provider;

export function getProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: WalletProvider }).ethereum ?? null;
}

/**
 * True when an error, or anything it wraps, carries `code`. Wallets and viem
 * nest the original code several levels deep, and some wallets report 4902 as
 * `data.originalError.code`. Never matches on message text.
 */
export function hasErrorCode(error: unknown, code: number): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === "object" && current !== null; depth++) {
    const candidate = current as {
      code?: unknown;
      data?: { originalError?: { code?: unknown } };
      cause?: unknown;
    };
    if (candidate.code === code) return true;
    if (candidate.data?.originalError?.code === code) return true;
    current = candidate.cause;
  }
  return false;
}

export const isUserRejection = (error: unknown): boolean => hasErrorCode(error, USER_REJECTED);
export const isRequestAlreadyPending = (error: unknown): boolean =>
  hasErrorCode(error, REQUEST_ALREADY_PENDING);

function walletClientFor(provider: WalletProvider) {
  return createWalletClient({ chain: config.chain, transport: custom(provider) });
}

/** Accounts the wallet already shares with this site. No prompt is shown. */
export async function getConnectedAccount(provider: WalletProvider): Promise<Address | null> {
  const accounts = await walletClientFor(provider).getAddresses();
  return accounts[0] ?? null;
}

export async function getWalletChainId(provider: WalletProvider): Promise<number> {
  return walletClientFor(provider).getChainId();
}

/** Asks the wallet to connect. Shows the wallet's own prompt. */
export async function connectWallet(provider: WalletProvider): Promise<Address> {
  const accounts = await walletClientFor(provider).requestAddresses();
  const account = accounts[0];
  if (!account) throw new Error("Wallet returned no account");
  return account;
}

/** Switches to Monad testnet, adding the network first when the wallet doesn't know it (4902). */
export async function ensureCorrectChain(provider: WalletProvider): Promise<void> {
  const client = walletClientFor(provider);
  try {
    await client.switchChain({ id: config.chain.id });
  } catch (error) {
    if (!hasErrorCode(error, UNRECOGNIZED_CHAIN)) throw error;
    await client.addChain({ chain: config.chain });
    await client.switchChain({ id: config.chain.id });
  }
}

/**
 * Sends the AUSD transfer. Gas is viem's estimate with no padding, because
 * Monad charges the declared gas limit rather than the gas used (NFR-09).
 * Resolves with the transaction hash once the wallet has submitted it.
 */
export async function sendPayment(args: {
  provider: WalletProvider;
  account: Address;
  to: Address;
  amount: bigint;
}): Promise<Hash> {
  const { provider, account, to, amount } = args;
  const gas = await publicClient.estimateContractGas({
    address: config.ausdAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    account,
  });
  return walletClientFor(provider).writeContract({
    address: config.ausdAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    account,
    chain: config.chain,
    gas,
  });
}

export type ReceiptResult = "success" | "reverted";

/** Waits for the transaction. Throws if it is still unconfirmed after the configured timeout. */
export async function waitForPayment(hash: Hash): Promise<ReceiptResult> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: config.receiptPollMs,
    timeout: config.receiptTimeoutMs,
  });
  return receipt.status === "success" ? "success" : "reverted";
}
