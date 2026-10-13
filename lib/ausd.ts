import { erc20Abi, type Address } from "viem";
import { config } from "@/lib/config";
import { publicClient } from "@/lib/client";

export async function readSymbol(): Promise<string> {
  return publicClient.readContract({
    address: config.ausdAddress,
    abi: erc20Abi,
    functionName: "symbol",
  });
}

export async function readDecimals(): Promise<number> {
  return publicClient.readContract({
    address: config.ausdAddress,
    abi: erc20Abi,
    functionName: "decimals",
  });
}

/** The chain's latest block number. A new invoice records it as its starting point. */
export async function readBlockNumber(): Promise<number> {
  return Number(await publicClient.getBlockNumber());
}

let decimalsCache: number | null = null;

/** The decimals if they have already been read, so a screen can show amounts on its first frame. */
export function peekDecimals(): number | null {
  return decimalsCache;
}

/** Reads decimals() once from the contract, then reuses it. */
export async function getDecimals(): Promise<number> {
  if (decimalsCache === null) decimalsCache = await readDecimals();
  return decimalsCache;
}

/** AUSD balances in base units, in the same order as `addresses`. */
export async function readBalances(addresses: readonly Address[]): Promise<bigint[]> {
  return Promise.all(
    addresses.map((address) =>
      publicClient.readContract({
        address: config.ausdAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
    ),
  );
}

/** Native (MON) balance in wei. A payer needs some to cover gas. */
export async function readNativeBalance(address: Address): Promise<bigint> {
  return publicClient.getBalance({ address });
}
