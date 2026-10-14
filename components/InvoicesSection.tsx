"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import PaidMoment from "@/components/PaidMoment";
import {
  Button,
  EmptyState,
  Field,
  Skeleton,
  Spinner,
  StatusBadge,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { formatAmount, parseAmount, type ParsedAmount } from "@/lib/amount";
import NetworkBadge from "@/components/NetworkBadge";
import { getTokenDecimals, peekTokenDecimals, readBlockNumberOn } from "@/lib/chainReads";
import { DEFAULT_NETWORK, NETWORKS, type NetworkKey } from "@/lib/chains";
import { clientAddress } from "@/lib/clients";
import { config, explorerTxUrl } from "@/lib/config";
import {
  buildInvoice,
  buildPayLink,
  generateInvoiceId,
  generateSalt,
} from "@/lib/invoice";
import { resetScanMark } from "@/lib/receipts";
import { extraAmount } from "@/lib/reconcile";
import { rewindThrough } from "@/lib/scanPlan";
import { loadState, saveState, type StoredInvoice, type StoredState } from "@/lib/store";
import { NEW_INVOICE_EVENT } from "@/lib/events";
import { useTokenDecimals } from "@/lib/useTokenDecimals";
import { usePaymentWatcher } from "@/lib/usePaymentWatcher";
import { useArcPayments } from "@/lib/useArcPayments";

const NETWORK_ERROR = "Network is busy. Nothing was created. Try again.";

type Created = { invoiceId: string; clientName: string; link: string };

function amountMessage(reason: Extract<ParsedAmount, { ok: false }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "Enter an amount.";
    case "format":
      return "Use numbers only, like 50 or 50.25.";
    case "too_many_decimals":
      return "Use at most 2 decimals.";
    case "too_small":
      return "That amount is too small. The smallest is 0.01.";
    case "too_large":
      return `The largest invoice is ${config.invoiceMaxWholeAmount.toLocaleString("en-US")} AUSD.`;
  }
}

function ReceiptIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 8.5h5M9.5 12.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
    <Button variant="secondary" onClick={share}>
      Share
    </Button>
  );
}

export default function InvoicesSection({ state }: { state: StoredState }) {
  const [clientIndex, setClientIndex] = useState("");
  const [networkInput, setNetworkInput] = useState<NetworkKey>(DEFAULT_NETWORK);
  const [amountInput, setAmountInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [open, setOpen] = useState(state.invoices.length === 0);
  const clientRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const monadDecimals = useTokenDecimals("monad");
  const arcDecimals = useTokenDecimals("arc");
  const decimals = monadDecimals;
  const decimalsFor = (network: NetworkKey) => (network === "arc" ? arcDecimals : monadDecimals);
  const watcher = usePaymentWatcher();
  const arcWatcher = useArcPayments();
  const pendingMoment = watcher.moments[0] ?? arcWatcher.moments[0] ?? null;
  const dismissMoment = watcher.moments.length > 0 ? watcher.dismissFirst : arcWatcher.dismissFirst;

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

  function openForm() {
    setOpen(true);
    // Wait for the form to render, then bring the amount field into view.
    requestAnimationFrame(() => {
      const field = amountRef.current;
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
    });
  }

  // The summary's "New invoice" button asks this section to open the form.
  useEffect(() => {
    window.addEventListener(NEW_INVOICE_EVENT, openForm);
    return () => window.removeEventListener(NEW_INVOICE_EVENT, openForm);
  });

  const selected = clientsByIndex.get(Number(clientIndex)) ?? null;
  const hasName = state.displayName !== "";
  const canCreate = hasName && state.clients.length > 0;

  function payLinkFor(invoice: StoredInvoice, to: string, clientName: string): string {
    return buildPayLink(window.location.origin, {
      to: to as `0x${string}`,
      amt: BigInt(invoice.amount),
      inv: invoice.id,
      n: state.displayName,
      c: clientName,
      m: invoice.memo,
      b: invoice.createdBlock,
      network: invoice.network,
      salt: invoice.salt,
    });
  }

  function linkFor(invoice: StoredInvoice): string | null {
    const entry = clientsByIndex.get(invoice.clientIndex);
    if (!entry) return null;
    return payLinkFor(invoice, entry.address, entry.client.name);
  }

  function checkAmount(text: string, knownDecimals: number | null): string | null {
    if (knownDecimals === null) return text.trim() === "" ? amountMessage("empty") : null;
    const parsed = parseAmount(text, knownDecimals);
    return parsed.ok ? null : amountMessage(parsed.reason);
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    setFormError(null);
    setCreated(null);

    const pickProblem = selected === null ? "Choose a client." : null;
    setClientError(pickProblem);

    let tokenDecimals: number;
    try {
      tokenDecimals = await getTokenDecimals(networkInput);
    } catch {
      setFormError(NETWORK_ERROR);
      return;
    }
    const parsed = parseAmount(amountInput, tokenDecimals);
    const amountProblem = parsed.ok ? null : amountMessage(parsed.reason);
    setAmountError(amountProblem);

    if (pickProblem !== null) {
      clientRef.current?.focus();
      return;
    }
    if (!parsed.ok || selected === null) {
      amountRef.current?.focus();
      return;
    }

    setCreating(true);
    try {
      const createdBlock = await readBlockNumberOn(networkInput);
      const memo = memoInput.trim();
      const invoice = buildInvoice({
        id: generateInvoiceId(),
        client: selected.client,
        amount: parsed.units,
        memo,
        createdBlock,
        nowSeconds: Math.floor(Date.now() / 1000),
        network: networkInput,
        salt: networkInput === "arc" ? generateSalt() : null,
      });
      const current = loadState() ?? state;
      // Only Monad invoices are scanned for AUSD transfers, so only they move the scan mark back.
      const monad = networkInput === "monad";
      // The new invoice's block must be scanned, so an already-scanned mark moves back before it.
      const clients = monad
        ? current.clients.map((client) =>
            client.index === selected.client.index && client.scan
              ? { ...client, scan: { ...client.scan, through: rewindThrough(client.scan.through, createdBlock) } }
              : client,
          )
        : current.clients;
      saveState({ ...current, clients, invoices: [...current.invoices, invoice] });
      if (monad) resetScanMark(selected.client.index);
      setCreated({
        invoiceId: invoice.id,
        clientName: selected.client.name,
        link: payLinkFor(invoice, selected.address, selected.client.name),
      });
      setAmountInput("");
      setMemoInput("");
      setAmountError(null);
      setOpen(false);
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setCreating(false);
    }
  }

  const invoices = [...state.invoices].reverse();

  return (
    <section className="mt-12" aria-labelledby="invoices-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="invoices-heading" className="font-display text-2xl font-bold tracking-tight">
          Invoices
        </h2>
        {watcher.checking && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Checking for payments...
          </p>
        )}
      </div>
      {watcher.failed && (
        <p role="status" className="mt-2 text-sm font-medium text-amber-ink">
          Network is busy, retrying...
        </p>
      )}

      {canCreate && open ? (
        <form onSubmit={createInvoice} className="mt-4 flex flex-col gap-4" noValidate>
          <Field id="invoice-client" label="Client" error={clientError}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                ref={clientRef}
                value={clientIndex}
                onChange={(e) => {
                  setClientIndex(e.target.value);
                  setClientError(null);
                }}
                className={`${inputClass} ${clientError ? "border-clay" : "border-line"}`}
              >
                <option value="">Choose a client</option>
                {state.clients.map((client) => (
                  <option key={client.index} value={client.index}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="invoice-network" label="Network" hint="Arc settles real USDC. Monad testnet uses test AUSD.">
            {(fieldProps) => (
              <select
                {...fieldProps}
                value={networkInput}
                onChange={(e) => {
                  setNetworkInput(e.target.value as NetworkKey);
                  setAmountError(null);
                }}
                className={`${inputClass} border-line`}
              >
                {(["monad", "arc"] as const).map((key) => (
                  <option key={key} value={key}>
                    {NETWORKS[key].label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="invoice-amount"
            label={`Amount in dollars (${NETWORKS[networkInput].token.symbol})`}
            hint="Up to 2 decimals, from 0.01 to 1,000,000."
            error={amountError}
          >
            {(fieldProps) => (
              <input
                {...fieldProps}
                ref={amountRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="50.00"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  if (amountError) setAmountError(null);
                }}
                onBlur={() => {
                  if (amountInput.trim() !== "") setAmountError(checkAmount(amountInput, peekTokenDecimals(networkInput)));
                }}
                className={`${inputClass} ${amountError ? "border-clay" : "border-line"}`}
              />
            )}
          </Field>

          <Field id="invoice-memo" label="Note (optional)" hint="What the payment is for. Up to 80 characters.">
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                maxLength={config.memoMaxLength}
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                className={`${inputClass} border-line`}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={creating}>
              {creating && <Spinner />}
              {creating ? "Creating..." : "Create invoice"}
            </Button>
            {state.invoices.length > 0 && (
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={creating}>
                Cancel
              </Button>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-sm font-medium text-clay">
              {formError}
            </p>
          )}
        </form>
      ) : !canCreate ? (
        <p className="mt-3 max-w-[44ch] text-muted">
          {!hasName
            ? "Add your name first, so clients know who the invoice is from."
            : "Add a client first, then you can create an invoice for them."}
        </p>
      ) : null}

      {created && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-palm/40 bg-palm-soft p-4"
          data-testid="invoice-created"
        >
          <p className="font-semibold text-palm">
            Invoice created for {created.clientName}. Send them this link.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <CopyButton text={created.link} label="Copy link" className={buttonClass("primary")} />
            <ShareButton url={created.link} title={`Invoice from ${state.displayName}`} />
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<ReceiptIcon />} title="No invoices yet">
            Create an invoice, then send the link to your client. You&apos;ll see it marked Paid the
            moment they pay.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {invoices.map((invoice) => {
            const entry = clientsByIndex.get(invoice.clientIndex);
            const link = linkFor(invoice);
            const extra = extraAmount(invoice);
            const invoiceDecimals = decimalsFor(invoice.network);
            const symbol = NETWORKS[invoice.network].token.symbol;
            return (
              <li key={invoice.id} className="py-4" data-testid={`invoice-${invoice.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{entry?.client.name ?? "Unknown client"}</p>
                    {invoice.memo !== "" && <p className="break-words text-muted">{invoice.memo}</p>}
                    <div className="mt-2">
                      <NetworkBadge network={invoice.network} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {invoiceDecimals === null ? (
                      <Skeleton className="ml-auto h-6 w-24" />
                    ) : (
                      <p className="font-display text-xl font-semibold tabular-nums">
                        {formatAmount(BigInt(invoice.amount), invoiceDecimals)}{" "}
                        <span className="text-base text-muted">{symbol}</span>
                      </p>
                    )}
                    <div className="mt-1" data-testid="invoice-status">
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                </div>

                {invoice.status === "underpaid" && invoiceDecimals !== null && invoice.paidAmount !== null && (
                  <p className="mt-2 text-sm font-medium text-amber-ink" data-testid="invoice-received">
                    Underpaid: received {formatAmount(BigInt(invoice.paidAmount), invoiceDecimals)} of{" "}
                    {formatAmount(BigInt(invoice.amount), invoiceDecimals)} {symbol}
                  </p>
                )}
                {invoiceDecimals !== null && extra > 0n && (
                  <p className="mt-2 text-sm font-medium text-palm" data-testid="invoice-extra">
                    +{formatAmount(extra, invoiceDecimals)} {symbol} extra
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {link !== null && invoice.status !== "paid" && (
                    <>
                      <CopyButton text={link} label="Copy link" className={buttonClass("secondary")} />
                      <ShareButton url={link} title={`Invoice from ${state.displayName}`} />
                    </>
                  )}
                  {invoice.paidTx !== null && (
                    <a
                      className={buttonClass("quiet")}
                      href={explorerTxUrl(invoice.paidTx, invoice.network)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View payment
                    </a>
                  )}
                  {link !== null && invoice.status === "paid" && (
                    <CopyButton text={link} label="Copy link" className={buttonClass("quiet")} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingMoment !== null && decimals !== null && (
        <PaidMoment
          moment={pendingMoment}
          decimals={decimals}
          freelancerName={state.displayName}
          onDismiss={dismissMoment}
        />
      )}
    </section>
  );
}
