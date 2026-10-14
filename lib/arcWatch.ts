import type { Address, Hex } from "viem";
import { findArcPaymentTx, readArcBlockTimestamp, readArcPaid } from "@/lib/arcChain";
import { arcInvoiceId } from "@/lib/arcPay";
import { clientAddress } from "@/lib/clients";
import type { PaidMoment } from "@/lib/receipts";
import { loadState, saveState } from "@/lib/store";

/**
 * Marks open Arc invoices as Paid when KudiPay.paid(invoiceId) says so, using
 * the InvoicePaid log for the transaction. Returns the invoices that flipped
 * in this pass, as moments. An invoice paid but without its log yet is left
 * open and checked again on the next pass.
 */
export async function checkArcInvoices(): Promise<PaidMoment[]> {
  const start = loadState();
  if (!start) return [];

  const open = start.invoices.filter(
    (invoice) => invoice.network === "arc" && invoice.status !== "paid" && invoice.salt !== null,
  );
  if (open.length === 0) return [];

  const hits: Array<{ id: string; clientName: string; amount: string; createdAt: number; tx: string; paidAt: number }> = [];
  for (const invoice of open) {
    const client = start.clients.find((entry) => entry.index === invoice.clientIndex);
    if (!client || invoice.salt === null) continue;
    const freelancer = clientAddress(start.accountXpub, client) as Address;
    const invoiceId: Hex = arcInvoiceId(freelancer, BigInt(invoice.amount), invoice.salt as Hex);
    if (!(await readArcPaid(invoiceId))) continue;
    const payment = await findArcPaymentTx(invoiceId, invoice.createdBlock);
    if (!payment) continue;
    hits.push({
      id: invoice.id,
      clientName: client.name,
      amount: invoice.amount,
      createdAt: invoice.createdAt,
      tx: payment.hash,
      paidAt: await readArcBlockTimestamp(payment.block),
    });
  }
  if (hits.length === 0) return [];

  // Re-read so changes made while the chain was read are not lost.
  const fresh = loadState();
  if (!fresh) return [];
  const byId = new Map(hits.map((hit) => [hit.id, hit]));
  const flipped: string[] = [];
  const invoices = fresh.invoices.map((invoice) => {
    const hit = byId.get(invoice.id);
    if (!hit || invoice.status === "paid") return invoice;
    flipped.push(invoice.id);
    return {
      ...invoice,
      status: "paid" as const,
      paidTx: hit.tx,
      paidAmount: invoice.amount,
      paidAt: hit.paidAt,
    };
  });
  if (flipped.length > 0) saveState({ ...fresh, invoices });

  return hits
    .filter((hit) => flipped.includes(hit.id))
    .map((hit) => ({
      invoiceId: hit.id,
      network: "arc",
      clientName: hit.clientName,
      amount: BigInt(hit.amount),
      extra: 0n,
      tx: hit.tx,
      elapsedSeconds: Math.max(0, hit.paidAt - hit.createdAt),
    }));
}
