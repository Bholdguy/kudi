"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { formatAmount, parseAmount, type ParsedAmount } from "@/lib/amount";
import { getDecimals, readBlockNumber } from "@/lib/ausd";
import { clientAddress } from "@/lib/clients";
import { config, explorerTxUrl } from "@/lib/config";
import { buildInvoice, buildPayLink, generateInvoiceId } from "@/lib/invoice";
import { loadState, saveState, type StoredInvoice, type StoredState } from "@/lib/store";
import { useDecimals } from "@/lib/useDecimals";

const primaryButton =
  "min-h-11 rounded-lg bg-black px-4 text-base font-medium text-white disabled:opacity-60";
const secondaryButton =
  "min-h-11 rounded-lg border border-zinc-400 px-4 text-sm font-medium text-zinc-900";
const inputClass = "min-h-11 w-full rounded-lg border border-zinc-400 px-3 text-base";

const STATUS_LABEL: Record<StoredInvoice["status"], string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  underpaid: "Underpaid",
};

const NETWORK_ERROR = "Network is busy. Nothing was created. Try again.";

function amountError(reason: Extract<ParsedAmount, { ok: false }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "Enter an amount.";
    case "format":
      return "Use numbers only, like 50 or 50.25.";
    case "too_many_decimals":
      return "Use at most 2 decimals.";
    case "too_small":
      return "That amount is too small.";
    case "too_large":
      return `The largest invoice is ${config.invoiceMaxWholeAmount.toLocaleString("en-US")} AUSD.`;
  }
}

function ShareButton({ url, title }: { url: string; title: string }) {
  if (typeof navigator.share !== "function") return null;
  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The person closed the share sheet: nothing to do.
    }
  }
  return (
    <button type="button" className={secondaryButton} onClick={share}>
      Share
    </button>
  );
}

export default function InvoicesSection({ state }: { state: StoredState }) {
  const [clientIndex, setClientIndex] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decimals = useDecimals();

  const clientsByIndex = useMemo(
    () =>
      new Map(
        state.clients.map((client) => [
          client.index,
          { client, address: clientAddress(state.accountXpub, client) },
        ]),
      ),
    [state.clients, state.accountXpub],
  );

  const selected = clientsByIndex.get(Number(clientIndex)) ?? null;
  const hasName = state.displayName !== "";
  const canCreate = hasName && state.clients.length > 0;

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (creating || selected === null) return;
    setError(null);

    let decimals: number;
    try {
      decimals = await getDecimals();
    } catch {
      setError(NETWORK_ERROR);
      return;
    }
    const parsed = parseAmount(amountInput, decimals);
    if (!parsed.ok) {
      setError(amountError(parsed.reason));
      return;
    }
    const memo = memoInput.trim();
    if (memo.length > config.memoMaxLength) {
      setError(`Keep the note under ${config.memoMaxLength} characters.`);
      return;
    }

    setCreating(true);
    try {
      const createdBlock = await readBlockNumber();
      const invoice = buildInvoice({
        id: generateInvoiceId(),
        client: selected.client,
        amount: parsed.units,
        memo,
        createdBlock,
        nowSeconds: Math.floor(Date.now() / 1000),
      });
      const current = loadState() ?? state;
      saveState({ ...current, invoices: [...current.invoices, invoice] });
      setAmountInput("");
      setMemoInput("");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setCreating(false);
    }
  }

  function linkFor(invoice: StoredInvoice): string | null {
    const entry = clientsByIndex.get(invoice.clientIndex);
    if (!entry) return null;
    return buildPayLink(window.location.origin, {
      to: entry.address as `0x${string}`,
      amt: BigInt(invoice.amount),
      inv: invoice.id,
      n: state.displayName,
      c: entry.client.name,
      m: invoice.memo,
      b: invoice.createdBlock,
    });
  }

  const invoices = [...state.invoices].reverse();

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Invoices</h2>

      {!hasName && (
        <p className="mt-3 text-zinc-700">
          Add your name first, so clients know who the invoice is from.
        </p>
      )}
      {hasName && state.clients.length === 0 && (
        <p className="mt-3 text-zinc-700">Add a client first, then you can create an invoice.</p>
      )}

      {canCreate && (
        <form onSubmit={createInvoice} className="mt-3 flex flex-col gap-3">
          <label htmlFor="invoice-client" className="text-base font-medium">
            Client
          </label>
          <select
            id="invoice-client"
            value={clientIndex}
            onChange={(e) => setClientIndex(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose a client</option>
            {state.clients.map((client) => (
              <option key={client.index} value={client.index}>
                {client.name}
              </option>
            ))}
          </select>

          <label htmlFor="invoice-amount" className="text-base font-medium">
            Amount in dollars (AUSD)
          </label>
          <input
            id="invoice-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="50.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className={inputClass}
          />

          <label htmlFor="invoice-memo" className="text-base font-medium">
            Note (optional)
          </label>
          <input
            id="invoice-memo"
            type="text"
            maxLength={config.memoMaxLength}
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
            className={inputClass}
          />

          <button
            type="submit"
            className={primaryButton}
            disabled={creating || selected === null || amountInput.trim() === ""}
          >
            {creating ? "Creating..." : "Create invoice"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
        </form>
      )}

      {invoices.length === 0 ? (
        <p className="mt-6 text-zinc-700">No invoices yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-300 rounded-lg border border-zinc-300">
          {invoices.map((invoice) => {
            const entry = clientsByIndex.get(invoice.clientIndex);
            const link = linkFor(invoice);
            return (
              <li key={invoice.id} className="p-4" data-testid={`invoice-${invoice.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry?.client.name ?? "Unknown client"}</p>
                    {invoice.memo !== "" && (
                      <p className="break-words text-sm text-zinc-700">{invoice.memo}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-base">
                      {decimals === null
                        ? "Loading..."
                        : `${formatAmount(BigInt(invoice.amount), decimals)} AUSD`}
                    </p>
                    <p className="text-sm font-medium" data-testid="invoice-status">
                      {STATUS_LABEL[invoice.status]}
                    </p>
                  </div>
                </div>
                {invoice.paidTx !== null && (
                  <a
                    className="mt-2 inline-block min-h-11 py-2 text-sm underline"
                    href={explorerTxUrl(invoice.paidTx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View payment
                  </a>
                )}
                {link !== null && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <CopyButton text={link} label="Copy link" className={secondaryButton} />
                    <ShareButton url={link} title={`Invoice from ${state.displayName}`} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
