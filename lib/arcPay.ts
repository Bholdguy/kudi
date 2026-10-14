import { encodeAbiParameters, keccak256, parseAbi, type Address, type Hex } from "viem";
import { config } from "@/lib/config";

/**
 * Invoices store amounts at the token's ERC-20 decimals (6 for USDC). Arc's
 * native USDC uses 18, so a payment sends the stored amount scaled by 10^12.
 * Never mix the two: a 6-decimal value sent as native is 10^12 too small.
 */
const ARC_STORED_DECIMALS = 6;
const ARC_NATIVE_DECIMALS = 18;
const ARC_SCALE = 10n ** BigInt(ARC_NATIVE_DECIMALS - ARC_STORED_DECIMALS);

const GWEI = 1_000_000_000n;
const MAX_CAUSE_DEPTH = 10;

/** The native value (18 decimals) to send for a stored invoice amount (6 decimals). */
export function arcNativeValue(storedAmount: bigint): bigint {
  return storedAmount * ARC_SCALE;
}

export const KUDI_PAY_ABI = parseAbi([
  "function pay(address payable freelancer, bytes32 salt) payable",
  "function paid(bytes32 invoiceId) view returns (bool)",
  "function invoiceIdOf(address freelancer, uint256 amount, bytes32 salt) pure returns (bytes32)",
  "event InvoicePaid(bytes32 indexed invoiceId, address indexed payer, address indexed freelancer, uint256 amount)",
  "error ZeroAmount()",
  "error ZeroAddress()",
  "error AlreadyPaid()",
  "error TransferFailed()",
]);

/**
 * The invoice ID the contract derives: keccak256(abi.encode(freelancer, value, salt)).
 * `value` is the native amount, so this matches invoiceIdOf on chain.
 */
export function arcInvoiceId(freelancer: Address, storedAmount: bigint, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }],
      [freelancer, arcNativeValue(storedAmount), salt],
    ),
  );
}

/**
 * Max fee per gas: the network's estimate, but never below the floor. Arc
 * silently drops transactions priced under 20 gwei, so the floor sits above it.
 */
export function arcFees(networkMaxFee: bigint | null): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const floor = BigInt(config.arcMaxFeeFloorGwei) * GWEI;
  const estimate = networkMaxFee ?? 0n;
  return {
    maxFeePerGas: estimate > floor ? estimate : floor,
    maxPriorityFeePerGas: BigInt(config.arcPriorityFeeGwei) * GWEI,
  };
}

/** The most the payer can be charged: the value plus gas at the max fee. */
export function arcCostCeiling(value: bigint, gas: bigint, maxFeePerGas: bigint): bigint {
  return value + gas * maxFeePerGas;
}

/** The name of the KudiPay custom error that caused a failure, if any. */
export function arcRevertName(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === "object" && current !== null; depth++) {
    const candidate = current as { errorName?: unknown; data?: { errorName?: unknown }; cause?: unknown };
    if (typeof candidate.data?.errorName === "string") return candidate.data.errorName;
    if (typeof candidate.errorName === "string") return candidate.errorName;
    current = candidate.cause;
  }
  return null;
}

const REVERT_MESSAGES: Record<string, string> = {
  AlreadyPaid: "This invoice has already been paid. Nothing was sent.",
  ZeroAmount: "The amount must be more than zero. Nothing was sent.",
  ZeroAddress: "The freelancer address is not valid. Nothing was sent.",
  TransferFailed: "The freelancer's address refused the payment. Nothing was sent.",
};

/** The customer-facing text for a KudiPay revert, or the generic text when unknown. */
export function arcRevertMessage(name: string | null): string {
  return (name !== null && REVERT_MESSAGES[name]) || "The payment was rejected by the network. Nothing was sent.";
}
