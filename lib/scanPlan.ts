import { config } from "@/lib/config";
import type { StoredInvoice } from "@/lib/store";

export type BlockWindow = { from: number; to: number };

export type ScanPlan = {
  windows: BlockWindow[];
  /** True when the windows reach the head block. False when the per-pass cap cut the plan short. */
  reachesHead: boolean;
  /** The block scanned through once every window succeeds. Unchanged when there is nothing to scan. */
  through: number;
};

/**
 * Splits the blocks after `through` up to `head` into windows the RPC accepts
 * (it rejects eth_getLogs ranges over about 100 blocks). Used for the first
 * catch-up AND for every live poll, so a gap of any size (phone asleep, tab
 * hidden) is covered by more windows, never by one oversized request.
 */
export function planScan(
  through: number,
  head: number,
  maxBlocks: number = config.logMaxBlocks,
  maxWindows: number = config.scanMaxWindowsPerPass,
): ScanPlan {
  const windows: BlockWindow[] = [];
  let from = through + 1;
  while (from <= head && windows.length < maxWindows) {
    const to = Math.min(from + maxBlocks - 1, head);
    windows.push({ from, to });
    from = to + 1;
  }
  return {
    windows,
    reachesHead: from > head,
    through: windows.length > 0 ? windows[windows.length - 1].to : through,
  };
}

/** First scan of a client: start at the block just before its oldest invoice. */
export function initialThrough(invoices: readonly StoredInvoice[]): number {
  return Math.min(...invoices.map((invoice) => invoice.createdBlock)) - 1;
}

/**
 * The block to record as scanned once a pass finishes. Invoices created while
 * the pass was running must still be scanned from their own block, so they pull
 * the mark back to just before it.
 */
export function settledThrough(
  planned: number,
  invoicesAtStart: ReadonlySet<string>,
  invoicesNow: readonly StoredInvoice[],
): number {
  return invoicesNow
    .filter((invoice) => !invoicesAtStart.has(invoice.id))
    .reduce((through, invoice) => Math.min(through, invoice.createdBlock - 1), planned);
}

/** A new invoice's block must be scanned, so an already-scanned mark moves back before it. */
export function rewindThrough(through: number, newInvoiceBlock: number): number {
  return Math.min(through, newInvoiceBlock - 1);
}
