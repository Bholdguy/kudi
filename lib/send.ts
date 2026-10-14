import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { config } from "@/lib/config";

/** USDC as an ERC-20 has 6 decimals. Sends are typed at up to 6 so 0.005 USDC works. */
const SEND_DECIMALS = 6;
const NATIVE_DECIMALS = 18;
const SEND_PATTERN = /^(\d+)(?:\.(\d{1,6}))?$/;
const GWEI = 1_000_000_000n;

/** Parses a typed send amount into native base units (18 decimals). Null when it is not a positive amount. */
export function parseSendAmount(text: string): bigint | null {
  const match = SEND_PATTERN.exec(text.trim());
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? "").padEnd(SEND_DECIMALS, "0");
  const units = whole * 10n ** BigInt(SEND_DECIMALS) + BigInt(fraction || "0");
  if (units === 0n) return null;
  // Scale 6-decimal USDC to the native 18-decimal value the chain transfers.
  return units * 10n ** BigInt(NATIVE_DECIMALS - SEND_DECIMALS);
}

/**
 * The text for an amount in native units, rounded DOWN to the 6 decimals a
 * send can be typed at. Max uses this, so the field never asks for more than
 * the balance covers.
 */
export function sendAmountText(units: bigint): string {
  const floored = units - (units % 10n ** 12n);
  const whole = floored / 10n ** 18n;
  const fraction = (floored % 10n ** 18n) / 10n ** 12n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(SEND_DECIMALS, "0").replace(/0+$/, "")}`;
}

/** Gas cost of a transfer at the given max fee, with the safety margin added. */
export function gasCostWithMargin(gas: bigint, maxFeePerGas: bigint): bigint {
  const cost = gas * maxFeePerGas;
  return cost + (cost * BigInt(config.sendGasMarginPercent)) / 100n;
}

/**
 * The most that can be sent from `balance`: the balance minus the gas cost at
 * `maxFeePerGas` (the 25 gwei floor by default), with the margin. Zero when the
 * balance does not cover gas.
 */
export function maxSendable(balance: bigint, gas: bigint, maxFeePerGas: bigint = BigInt(config.arcMaxFeeFloorGwei) * GWEI): bigint {
  const fee = gasCostWithMargin(gas, maxFeePerGas);
  return balance > fee ? balance - fee : 0n;
}

export type SendInput = {
  from: Address;
  /** What the freelancer typed. */
  to: string;
  /** What the freelancer typed, in USDC. */
  amountText: string;
  /** The from-address balance in native base units. */
  balance: bigint;
  /** Estimated gas for the transfer. */
  gas: bigint;
  maxFeePerGas: bigint;
};

export type SendCheck =
  | { ok: true; to: Address; value: bigint; fee: bigint }
  | { ok: false; field: "to" | "amount" | "balance"; message: string };

/**
 * Checks a send before anything is signed. The recipient must be a valid
 * address (checksummed, or all lowercase with no checksum to check), not the
 * zero address, and not the from-address. The amount must be positive and at
 * most the Max. Returns the checksummed recipient, the value and the fee.
 */
export function validateSend(input: SendInput): SendCheck {
  const typed = input.to.trim();
  if (!isAddress(typed, { strict: false })) {
    return { ok: false, field: "to", message: "Enter a valid address that starts with 0x." };
  }
  // Mixed case must match its checksum. Lowercase carries no checksum, so it is accepted.
  const mixedCase = typed !== typed.toLowerCase() && typed !== typed.toUpperCase();
  if (mixedCase && !isAddress(typed, { strict: true })) {
    return { ok: false, field: "to", message: "This address has a typo. Check it and try again." };
  }
  const to = getAddress(typed);
  if (to === zeroAddress) {
    return { ok: false, field: "to", message: "Sending to the zero address is not allowed." };
  }
  if (to.toLowerCase() === input.from.toLowerCase()) {
    return { ok: false, field: "to", message: "Pick a different address. This is the one you're sending from." };
  }

  const value = parseSendAmount(input.amountText);
  if (value === null) {
    return { ok: false, field: "amount", message: "Enter an amount above zero, with up to 6 decimals." };
  }
  const max = maxSendable(input.balance, input.gas, input.maxFeePerGas);
  if (value > max) {
    return {
      ok: false,
      field: "amount",
      message: max === 0n
        ? "This address doesn't have enough USDC to cover the network fee."
        : "That's more than you can send. The most is the Max amount.",
    };
  }
  return { ok: true, to, value, fee: input.gas * input.maxFeePerGas };
}

export type SendFailureKind = "insufficient" | "refused" | "network";

/**
 * Sorts a failed gas estimate or broadcast into what the freelancer can act on:
 * too little USDC, a transfer the chain refused (such as a blocked address), or
 * a network problem. Looks at the message text of the error chain, which is
 * the only signal the node gives.
 */
export function classifySendError(error: unknown): SendFailureKind {
  const texts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 10 && typeof current === "object" && current !== null; depth++) {
    const candidate = current as { message?: unknown; shortMessage?: unknown; cause?: unknown };
    if (typeof candidate.shortMessage === "string") texts.push(candidate.shortMessage);
    if (typeof candidate.message === "string") texts.push(candidate.message);
    current = candidate.cause;
  }
  const text = texts.join(" ").toLowerCase();
  if (text.includes("insufficient funds") || text.includes("exceeds balance")) return "insufficient";
  if (text.includes("revert") || text.includes("blocked") || text.includes("blocklist")) return "refused";
  return "network";
}
