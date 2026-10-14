import type { Address, Hash, Hex } from "viem";
import { NETWORKS } from "@/lib/chains";
import { publicClientFor } from "@/lib/client";
import { KUDI_PAY_ABI } from "@/lib/arcPay";

const arcClient = () => publicClientFor("arc");
const kudiPayAddress = (): Address => {
  const method = NETWORKS.arc.payMethod;
  if (method.kind !== "kudiPay") throw new Error("Arc pay method is not KudiPay");
  return method.contract;
};

/** KudiPay.paid(invoiceId): true once a payment for this invoice has landed. */
export async function readArcPaid(invoiceId: Hex): Promise<boolean> {
  return arcClient().readContract({
    address: kudiPayAddress(),
    abi: KUDI_PAY_ABI,
    functionName: "paid",
    args: [invoiceId],
  });
}

/** The InvoicePaid log for this invoice, from the invoice's block onward. Null when none is found. */
export async function findArcPaymentTx(
  invoiceId: Hex,
  fromBlock: number,
): Promise<{ hash: Hash; block: bigint } | null> {
  const logs = await arcClient().getContractEvents({
    address: kudiPayAddress(),
    abi: KUDI_PAY_ABI,
    eventName: "InvoicePaid",
    args: { invoiceId },
    fromBlock: BigInt(fromBlock),
    toBlock: "latest",
  });
  const log = logs[0];
  if (!log) return null;
  return { hash: log.transactionHash, block: log.blockNumber };
}

/** Unix seconds of a block. */
export async function readArcBlockTimestamp(block: bigint): Promise<number> {
  const found = await arcClient().getBlock({ blockNumber: block });
  return Number(found.timestamp);
}

/** Native USDC balance in wei (18 decimals). */
export async function readArcNativeBalance(address: Address): Promise<bigint> {
  return arcClient().getBalance({ address });
}

/** Gas for KudiPay.pay with this value, estimated by the node. Throws with the revert when it would fail. */
export async function estimateArcPayGas(args: {
  freelancer: Address;
  salt: Hex;
  value: bigint;
  account: Address;
}): Promise<bigint> {
  return arcClient().estimateContractGas({
    address: kudiPayAddress(),
    abi: KUDI_PAY_ABI,
    functionName: "pay",
    args: [args.freelancer, args.salt],
    value: args.value,
    account: args.account,
  });
}

/** The network's current max fee per gas, or null when the node gives none. */
export async function readArcMaxFee(): Promise<bigint | null> {
  const fees = await arcClient().estimateFeesPerGas();
  return fees.maxFeePerGas ?? null;
}

/** Gas for a plain native USDC transfer, estimated by the node. */
export async function estimateArcTransferGas(args: { from: Address; to: Address; value: bigint }): Promise<bigint> {
  return arcClient().estimateGas({ account: args.from, to: args.to, value: args.value });
}

/** The next nonce for an address, counting its pending transactions. */
export async function readArcNonce(address: Address): Promise<number> {
  return arcClient().getTransactionCount({ address, blockTag: "pending" });
}

/** Broadcasts a signed transaction and returns its hash. */
export async function sendArcRawTransaction(serializedTransaction: Hex): Promise<Hash> {
  return arcClient().sendRawTransaction({ serializedTransaction });
}
