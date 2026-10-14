import { erc20Abi } from "viem";
import { NETWORKS, type NetworkKey } from "@/lib/chains";
import { publicClientFor } from "@/lib/client";

const decimalsCache = new Map<NetworkKey, number>();

/** The token's decimals if already read, so a screen can show amounts on its first frame. */
export function peekTokenDecimals(network: NetworkKey): number | null {
  return decimalsCache.get(network) ?? null;
}

/** Reads decimals() from the network's token contract once, then reuses it. */
export async function getTokenDecimals(network: NetworkKey): Promise<number> {
  const cached = decimalsCache.get(network);
  if (cached !== undefined) return cached;
  const value = await publicClientFor(network).readContract({
    address: NETWORKS[network].token.address,
    abi: erc20Abi,
    functionName: "decimals",
  });
  decimalsCache.set(network, value);
  return value;
}

/** The network's latest block number. A new invoice records it as its starting point. */
export async function readBlockNumberOn(network: NetworkKey): Promise<number> {
  return Number(await publicClientFor(network).getBlockNumber());
}
