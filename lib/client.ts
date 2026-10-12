import { createPublicClient, fallback, http } from "viem";
import { config } from "@/lib/config";

export const publicClient = createPublicClient({
  chain: config.chain,
  transport: fallback(
    config.rpcUrls.map((url) =>
      http(url, {
        retryCount: config.rpcRetryCount,
        retryDelay: config.rpcRetryDelayMs,
      }),
    ),
    { retryCount: config.rpcRetryCount, retryDelay: config.rpcRetryDelayMs },
  ),
});
