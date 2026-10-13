import type { Address } from "viem";
import { readBalances } from "@/lib/ausd";
import { config } from "@/lib/config";
import { addressAt } from "@/lib/passkey";
import type { StoredClient } from "@/lib/store";

/**
 * How many clients to bring back: the position of the last address that holds
 * AUSD. `balances[0]` is client index 1. Earlier indexes without a balance are
 * kept too, so a client that has not paid yet keeps its place and address.
 */
export function recoveredClientCount(balances: readonly bigint[]): number {
  for (let position = balances.length; position >= 1; position--) {
    if (balances[position - 1] > 0n) return position;
  }
  return 0;
}

export function buildRecoveredClients(
  accountXpub: string,
  count: number,
  nowSeconds: number,
): StoredClient[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return {
      index,
      name: `Client ${index}`,
      address: addressAt(accountXpub, index),
      createdAt: nowSeconds,
    };
  });
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("recovery timed out")), ms));
}

/**
 * E16: after signing in with empty storage, rebuild the client list from the
 * chain. Names are lost, so clients come back as "Client 1", "Client 2", and so
 * on. Best effort: any failure returns no clients and the person can add them
 * again, which reuses the same addresses.
 */
export async function recoverClients(accountXpub: string, nowSeconds: number): Promise<StoredClient[]> {
  try {
    const addresses = Array.from({ length: config.recoveryProbeCount }, (_, i) =>
      addressAt(accountXpub, i + 1),
    ) as Address[];
    const balances = await Promise.race([
      readBalances(addresses),
      timeout(config.recoveryTimeoutMs),
    ]);
    return buildRecoveredClients(accountXpub, recoveredClientCount(balances), nowSeconds);
  } catch {
    return [];
  }
}
