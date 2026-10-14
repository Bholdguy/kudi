import {
  createWalletClient,
  custom,
  erc20Abi,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hash,
  type Hex,
} from "viem";
import { config } from "@/lib/config";
import { publicClient, publicClientFor } from "@/lib/client";
import { KUDI_PAY_ABI } from "@/lib/arcPay";
import { NETWORKS } from "@/lib/chains";

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

function walletClientFor(provider: WalletProvider, chain: Chain = config.chain) {
  return createWalletClient({ chain, transport: custom(provider) });
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

/** Switches the wallet to a chain, adding it first when the wallet doesn't know it (4902). */
export async function ensureChain(provider: WalletProvider, chain: Chain): Promise<void> {
  const client = walletClientFor(provider, chain);
  try {
    await client.switchChain({ id: chain.id });
  } catch (error) {
    if (!hasErrorCode(error, UNRECOGNIZED_CHAIN)) throw error;
    await client.addChain({ chain });
    await client.switchChain({ id: chain.id });
  }
}

/** Switches to Monad testnet, adding the network first when the wallet doesn't know it (4902). */
export async function ensureCorrectChain(provider: WalletProvider): Promise<void> {
  return ensureChain(provider, config.chain);
}

/**
 * Sends KudiPay.pay with the native USDC value. The fees are set by the caller
 * (the 25 gwei floor), and the gas limit is viem's estimate with no padding.
 */
export async function sendArcPayment(args: {
  provider: WalletProvider;
  account: Address;
  freelancer: Address;
  salt: Hex;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}): Promise<Hash> {
  const { provider, account, freelancer, salt, value, gas, maxFeePerGas, maxPriorityFeePerGas } = args;
  const arc = NETWORKS.arc;
  if (arc.payMethod.kind !== "kudiPay") throw new Error("Arc pay method is not KudiPay");
  return walletClientFor(provider, arc.chain).writeContract({
    address: arc.payMethod.contract,
    abi: KUDI_PAY_ABI,
    functionName: "pay",
    args: [freelancer, salt],
    account,
    chain: arc.chain,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
}

/** Waits for an Arc transaction. Throws if it is still unconfirmed after the configured timeout. */
export async function waitForArcReceipt(hash: Hash): Promise<ReceiptResult> {
  const receipt = await publicClientFor("arc").waitForTransactionReceipt({
    hash,
    pollingInterval: config.receiptPollMs,
    timeout: config.receiptTimeoutMs,
  });
  return receipt.status === "success" ? "success" : "reverted";
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
