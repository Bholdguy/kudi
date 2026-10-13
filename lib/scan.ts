import { erc20Abi, getAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/client";
import { config } from "@/lib/config";
import type { BlockWindow } from "@/lib/scanPlan";

const transferEvent = getAbiItem({ abi: erc20Abi, name: "Transfer" });

export type FoundTransfer = {
  /** Recipient, lower case, for matching back to a client address. */
  to: string;
  block: number;
  logIndex: number;
  tx: string;
  /** AUSD base units. */
  value: string;
};

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchWindow(addresses: readonly Address[], window: BlockWindow): Promise<FoundTransfer[]> {
  const logs = await publicClient.getLogs({
    address: config.ausdAddress,
    event: transferEvent,
    args: { to: [...addresses] },
    fromBlock: BigInt(window.from),
    toBlock: BigInt(window.to),
  });
  return logs.flatMap((log) =>
    log.blockNumber === null ||
    log.logIndex === null ||
    log.transactionHash === null ||
    log.args.to === undefined ||
    log.args.value === undefined
      ? []
      : [
          {
            to: log.args.to.toLowerCase(),
            block: Number(log.blockNumber),
            logIndex: log.logIndex,
            tx: log.transactionHash,
            value: log.args.value.toString(),
          },
        ],
  );
}

/** AUSD transfers to any of `addresses` in the given windows. Throws if any window fails. */
export async function fetchTransfers(
  addresses: readonly Address[],
  windows: readonly BlockWindow[],
): Promise<FoundTransfer[]> {
  const perWindow = await mapLimit(windows, config.scanConcurrency, (window) =>
    fetchWindow(addresses, window),
  );
  return perWindow.flat();
}

/** Block timestamps (unix seconds) for the given block numbers. */
export async function fetchTimestamps(blocks: readonly number[]): Promise<Map<number, number>> {
  const unique = [...new Set(blocks)];
  const stamps = await mapLimit(unique, config.scanConcurrency, async (block) => {
    const found = await publicClient.getBlock({ blockNumber: BigInt(block) });
    return [block, Number(found.timestamp)] as const;
  });
  return new Map(stamps);
}
