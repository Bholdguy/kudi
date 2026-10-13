import type { StoredInvoice, StoredTransfer } from "@/lib/store";

type Work = {
  invoice: StoredInvoice;
  amount: bigint;
  received: bigint;
  tx: string | null;
  at: number | null;
};

const transferKey = (t: StoredTransfer): string => `${t.tx}:${t.logIndex}`;

/** Adds newly found transfers to the cached ones, once each. Order is not kept. */
export function mergeTransfers(
  cached: readonly StoredTransfer[],
  found: readonly StoredTransfer[],
): StoredTransfer[] {
  const byKey = new Map<string, StoredTransfer>();
  for (const transfer of [...cached, ...found]) byKey.set(transferKey(transfer), transfer);
  return [...byKey.values()];
}

/** What a client paid beyond the invoiced amount, in base units. Zero unless fully paid. */
export function extraAmount(invoice: StoredInvoice): bigint {
  if (invoice.status !== "paid" || invoice.paidAmount === null) return 0n;
  const extra = BigInt(invoice.paidAmount) - BigInt(invoice.amount);
  return extra > 0n ? extra : 0n;
}

/**
 * Works out every invoice's status for ONE client from scratch, so running it
 * again with the same inputs always gives the same answer.
 *
 * Transfers are taken in chain order (block, then log index, E18). A transfer
 * only counts for invoices created at or before its block. For each transfer:
 *  1. the oldest open invoice that this transfer exactly completes is paid;
 *  2. otherwise the oldest open invoice takes it, and short payments add up
 *     (30 then 20 settles a 50 invoice). Paid once the total reaches the amount;
 *     anything beyond it is the extra (E12);
 *  3. with no open invoice the transfer matches nothing (E13).
 */
export function reconcileInvoices(
  invoices: readonly StoredInvoice[],
  transfers: readonly StoredTransfer[],
): StoredInvoice[] {
  const work: Work[] = invoices.map((invoice) => ({
    invoice,
    amount: BigInt(invoice.amount),
    received: 0n,
    tx: null,
    at: null,
  }));

  const oldestFirst = [...work].sort(
    (a, b) =>
      a.invoice.createdBlock - b.invoice.createdBlock ||
      a.invoice.createdAt - b.invoice.createdAt ||
      a.invoice.id.localeCompare(b.invoice.id),
  );

  const ordered = [...new Map(transfers.map((t) => [transferKey(t), t])).values()].sort(
    (a, b) => a.block - b.block || a.logIndex - b.logIndex,
  );

  for (const transfer of ordered) {
    const value = BigInt(transfer.value);
    const open = oldestFirst.filter(
      (w) => w.invoice.createdBlock <= transfer.block && w.received < w.amount,
    );
    if (open.length === 0) continue;
    const target = open.find((w) => w.amount - w.received === value) ?? open[0];
    target.received += value;
    target.tx = transfer.tx;
    target.at = transfer.timestamp;
  }

  return work.map(({ invoice, amount, received, tx, at }) => {
    if (received === 0n) {
      return { ...invoice, status: "unpaid", paidTx: null, paidAmount: null, paidAt: null };
    }
    return {
      ...invoice,
      status: received >= amount ? "paid" : "underpaid",
      paidTx: tx,
      paidAmount: received.toString(),
      paidAt: at,
    };
  });
}

export function invoicesChanged(
  before: readonly StoredInvoice[],
  after: readonly StoredInvoice[],
): boolean {
  return before.some((b, i) => {
    const a = after[i];
    return (
      a.status !== b.status ||
      a.paidTx !== b.paidTx ||
      a.paidAmount !== b.paidAmount ||
      a.paidAt !== b.paidAt
    );
  });
}
