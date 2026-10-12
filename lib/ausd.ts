import { erc20Abi } from "viem";
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
