import { DEFAULT_NETWORK, type NetworkKey } from "@/lib/chains";
import type { StoredInvoice } from "@/lib/store";

/** Total of the paid invoices on one network, in the invoice's stored base units. */
export function receivedFromPaidInvoices(invoices: readonly StoredInvoice[], network: NetworkKey): bigint {
  return invoices
    .filter((invoice) => invoice.network === network && invoice.status === "paid")
    .reduce((sum, invoice) => sum + BigInt(invoice.paidAmount ?? invoice.amount), 0n);
}

/** The network of the most recent paid invoice. Monad when nothing has been paid yet. */
export function defaultNetwork(invoices: readonly StoredInvoice[]): NetworkKey {
  let latest: { network: NetworkKey; paidAt: number } | null = null;
  for (const invoice of invoices) {
    if (invoice.status !== "paid" || invoice.paidAt === null) continue;
    if (latest === null || invoice.paidAt > latest.paidAt) {
      latest = { network: invoice.network, paidAt: invoice.paidAt };
    }
  }
  return latest?.network ?? DEFAULT_NETWORK;
}

/** The sum of every value, or null while any value is still unknown. */
export function sumKnown(values: ReadonlyArray<bigint | undefined>): bigint | null {
  let total = 0n;
  for (const value of values) {
    if (value === undefined) return null;
    total += value;
  }
  return total;
}
