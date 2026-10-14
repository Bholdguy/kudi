import { createPublicClient, fallback, http } from "viem";
import { config } from "@/lib/config";
import { NETWORKS, type NetworkKey } from "@/lib/chains";

function createClient(network: NetworkKey) {
  const entry = NETWORKS[network];
  return createPublicClient({
    chain: entry.chain,
    batch: { multicall: true },
    transport: fallback(
      entry.rpcUrls.map((url) =>
        http(url, { retryCount: config.rpcRetryCount, retryDelay: config.rpcRetryDelayMs }),
      ),
      { retryCount: config.rpcRetryCount, retryDelay: config.rpcRetryDelayMs },
    ),
  });
}

const clients = {
  monad: createClient("monad"),
  arc: createClient("arc"),
} satisfies Record<NetworkKey, ReturnType<typeof createClient>>;

export const publicClient = clients.monad;

/** The shared public client for one network. */
export function publicClientFor(network: NetworkKey) {
  return clients[network];
}
