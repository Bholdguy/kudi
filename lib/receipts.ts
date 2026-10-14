import type { Address } from "viem";
import { readBlockNumber } from "@/lib/ausd";
import { clientAddress } from "@/lib/clients";
import { isMonadInvoice } from "@/lib/invoice";
import { invoicesChanged, mergeTransfers, reconcileInvoices } from "@/lib/reconcile";
import { fetchTimestamps, fetchTransfers } from "@/lib/scan";
import { initialThrough, planScan, settledThrough } from "@/lib/scanPlan";
import {
  loadState,
  saveState,
  type StoredClient,
  type StoredInvoice,
  type StoredTransfer,
} from "@/lib/store";

/** A payment that arrived while the dashboard was open. */
export type PaidMoment = {
  invoiceId: string;
  clientName: string;
  /** Invoiced amount, base units. */
  amount: bigint;
  /** What was paid beyond the invoiced amount, base units. */
  extra: bigint;
  tx: string;
  /** Seconds from invoice creation to the payment's block. Null when unknown. */
  elapsedSeconds: number | null;
};

export type ScanOutcome = {
  /** True once this pass reached the chain's latest block. */
  reachedHead: boolean;
  moments: PaidMoment[];
};

// Scan progress between passes lives in memory so a live poll does not rewrite
// storage every 1.5 s. It is saved when something changes or the gap grows.
const PERSIST_EVERY_BLOCKS = 600;
const marks = new Map<number, number>();

/** Forget the in-memory mark for a client, e.g. after a new invoice rewound its saved one. */
export function resetScanMark(clientIndex: number): void {
  marks.delete(clientIndex);
}

type Target = {
  client: StoredClient;
  address: Address;
  through: number;
  invoiceIds: Set<string>;
};

function buildMoment(before: StoredInvoice, after: StoredInvoice, clientName: string): PaidMoment | null {
  if (before.status === "paid" || after.status !== "paid" || after.paidTx === null) return null;
  const amount = BigInt(after.amount);
  const received = after.paidAmount === null ? amount : BigInt(after.paidAmount);
  return {
    invoiceId: after.id,
    clientName,
    amount,
    extra: received > amount ? received - amount : 0n,
    tx: after.paidTx,
    elapsedSeconds: after.paidAt === null ? null : Math.max(0, after.paidAt - after.createdAt),
  };
}

/**
 * One pass: read the head block, fetch AUSD transfers to every client that has
 * invoices since the last scanned block (in windows the RPC accepts), then
 * recompute invoice statuses from scratch and save. Throws when the chain
 * cannot be read; nothing is advanced in that case, so the next pass retries.
 */
export async function scanPass(announce: boolean): Promise<ScanOutcome> {
  const start = loadState();
  if (!start) return { reachedHead: true, moments: [] };

  const targets: Target[] = start.clients.flatMap((client) => {
    // Arc invoices are paid in USDC on Arc, so only Monad invoices are matched against AUSD here.
    const invoices = start.invoices.filter(
      (invoice) => invoice.clientIndex === client.index && isMonadInvoice(invoice),
    );
    if (invoices.length === 0) return [];
    return [
      {
        client,
        address: clientAddress(start.accountXpub, client) as Address,
        through: marks.get(client.index) ?? client.scan?.through ?? initialThrough(invoices),
        invoiceIds: new Set(invoices.map((invoice) => invoice.id)),
      },
    ];
  });
  if (targets.length === 0) return { reachedHead: true, moments: [] };

  const head = await readBlockNumber();

  const groups = new Map<number, Target[]>();
  for (const target of targets) {
    groups.set(target.through, [...(groups.get(target.through) ?? []), target]);
  }

  const found: Array<{ target: Target; transfers: StoredTransfer[] }> = [];
  const newMarks = new Map<number, number>();
  let reachedHead = true;

  for (const [through, group] of groups) {
    const plan = planScan(through, head);
    if (!plan.reachesHead) reachedHead = false;
    const addresses = group.map((target) => target.address);
    const transfers = await fetchTransfers(addresses, plan.windows);
    const stamps = await fetchTimestamps(transfers.map((transfer) => transfer.block));
    for (const target of group) {
      newMarks.set(target.client.index, plan.through);
      found.push({
        target,
        transfers: transfers
          .filter((transfer) => transfer.to === target.address.toLowerCase())
          .map((transfer) => ({
            block: transfer.block,
            logIndex: transfer.logIndex,
            tx: transfer.tx,
            value: transfer.value,
            timestamp: stamps.get(transfer.block) ?? 0,
          })),
      });
    }
  }

  // Re-read so changes made while the chain was being read are not lost.
  const fresh = loadState();
  if (!fresh) return { reachedHead, moments: [] };

  const moments: PaidMoment[] = [];
  let invoices = fresh.invoices;
  let dirty = false;
  const clients = fresh.clients.map((client) => {
    const hit = found.find((entry) => entry.target.client.index === client.index);
    if (!hit) return client;

    const clientInvoices = invoices.filter(
      (invoice) => invoice.clientIndex === client.index && isMonadInvoice(invoice),
    );
    const cached = client.scan?.transfers ?? [];
    const merged = mergeTransfers(cached, hit.transfers);
    const settled = settledThrough(
      newMarks.get(client.index) ?? hit.target.through,
      hit.target.invoiceIds,
      clientInvoices,
    );
    marks.set(client.index, settled);

    const reconciled = reconcileInvoices(clientInvoices, merged);
    const changed = invoicesChanged(clientInvoices, reconciled);
    const gotNewTransfers = merged.length !== cached.length;
    const persistedThrough = client.scan?.through ?? -Infinity;

    if (changed) {
      const byId = new Map(reconciled.map((invoice) => [invoice.id, invoice]));
      if (announce) {
        for (const before of clientInvoices) {
          const moment = buildMoment(before, byId.get(before.id) ?? before, client.name);
          if (moment) moments.push(moment);
        }
      }
      invoices = invoices.map((invoice) => byId.get(invoice.id) ?? invoice);
    }

    const worthSaving =
      changed ||
      gotNewTransfers ||
      !client.scan ||
      settled - persistedThrough >= PERSIST_EVERY_BLOCKS;
    if (!worthSaving) return client;
    dirty = true;
    return { ...client, scan: { through: settled, transfers: merged } };
  });

  if (dirty) saveState({ ...fresh, clients, invoices });
  return { reachedHead, moments };
}
