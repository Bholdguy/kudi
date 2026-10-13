import { config } from "@/lib/config";
import type { StoredClient, StoredTransfer } from "@/lib/store";

export type ActivityItem = StoredTransfer & {
  clientIndex: number;
  clientName: string;
};

/**
 * The latest incoming AUSD transfers across all clients, newest first (KUDI-18).
 * Order is by block, then log index, so it never depends on the order the RPC
 * returned the logs (E18). A transfer that matched nothing, such as a second
 * payment for an invoice that is already paid, still appears here (E13).
 */
export function recentActivity(
  clients: readonly StoredClient[],
  limit: number = config.recentActivityLimit,
): ActivityItem[] {
  const seen = new Set<string>();
  const items: ActivityItem[] = [];
  for (const client of clients) {
    for (const transfer of client.scan?.transfers ?? []) {
      const key = `${transfer.tx}:${transfer.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...transfer, clientIndex: client.index, clientName: client.name });
    }
  }
  return items
    .sort((a, b) => b.block - a.block || b.logIndex - a.logIndex)
    .slice(0, limit);
}
