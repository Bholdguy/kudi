"use client";

import { useState } from "react";
import NameForm from "@/components/NameForm";
import { Button, CheckIcon, Skeleton } from "@/components/ui";
import { defaultNetwork } from "@/lib/assets";
import { formatAmount } from "@/lib/amount";
import { NETWORKS, type NetworkKey } from "@/lib/chains";
import { NEW_INVOICE_EVENT } from "@/lib/events";
import type { StoredState } from "@/lib/store";

export type NetworkFigures = {
  /** Paid invoices on this network, in the invoice's stored base units. */
  received: bigint;
  /** Decimals of `received`. Null until the token's decimals are read. */
  receivedDecimals: number | null;
  /** Live wallet balance summed across the receiving addresses. Null until all are read. */
  balance: bigint | null;
  /** Decimals of `balance`: the token's decimals on Monad, the native 18 on Arc. */
  balanceDecimals: number | null;
  balanceFailed: boolean;
};

type SummaryProps = {
  state: StoredState;
  figures: Record<NetworkKey, NetworkFigures>;
};

function focusField(id: string) {
  const field = document.getElementById(id);
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  field?.focus({ preventScroll: true });
}

function waitingText(count: number, hasInvoices: boolean): string | null {
  if (!hasInvoices) return null;
  if (count === 0) return "Every invoice is paid.";
  return count === 1 ? "1 invoice is waiting for payment." : `${count} invoices are waiting for payment.`;
}

const STEP_LABELS = ["Add your name", "Add a client", "Create an invoice"];
const NETWORK_TABS: readonly NetworkKey[] = ["monad", "arc"];

/** Top of the dashboard: who you are, what you've received per network, what's next. */
export default function Summary({ state, figures }: SummaryProps) {
  const [network, setNetwork] = useState<NetworkKey>(() => defaultNetwork(state.invoices));
  const hasName = state.displayName !== "";
  const hasClients = state.clients.length > 0;
  const hasInvoices = state.invoices.length > 0;
  const waiting = state.invoices.filter((invoice) => invoice.status !== "paid").length;

  if (!hasName) {
    return (
      <section className="pt-6" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading" className="font-display text-4xl font-bold leading-tight tracking-tight">
          Welcome to Kudi
        </h1>
        <p className="mt-2 max-w-[40ch] text-lg text-muted">
          Your account is ready. One quick thing before your first invoice.
        </p>
        <div className="mt-6 max-w-md">
          <NameForm initial="" submitLabel="Save and continue" />
        </div>
      </section>
    );
  }

  const done = [hasName, hasClients, hasInvoices];
  const allDone = done.every(Boolean);
  const waitingLine = waitingText(waiting, hasInvoices);
  const entry = NETWORKS[network];
  const symbol = entry.token.symbol;
  const shown = figures[network];

  return (
    <section className="pt-6" aria-labelledby="summary-heading">
      <h1 id="summary-heading" className="font-display text-4xl font-bold leading-tight tracking-tight">
        Hi, {state.displayName}
      </h1>

      {hasClients && (
        <div className="mt-4">
          <div role="tablist" aria-label="Network" className="inline-flex rounded-full bg-brand-soft p-1">
            {NETWORK_TABS.map((key) => {
              const selected = key === network;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setNetwork(key)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
                    selected ? "bg-brand text-white" : "text-brand hover:bg-brand/10"
                  }`}
                  data-testid={`asset-tab-${key}`}
                >
                  {NETWORKS[key].token.symbol} · {NETWORKS[key].shortName}
                </button>
              );
            })}
          </div>

          <div className="mt-4" role="tabpanel" aria-label={`${symbol} on ${entry.shortName}`}>
            <p className="text-muted">You&apos;ve received</p>
            <div className="mt-1 min-h-[3.25rem]" data-testid="total-received">
              {shown.receivedDecimals !== null ? (
                <p className="font-display text-5xl font-bold tabular-nums tracking-tight">
                  {formatAmount(shown.received, shown.receivedDecimals)}
                  <span className="ml-2 text-2xl font-semibold text-muted">{symbol}</span>
                </p>
              ) : (
                <Skeleton className="h-12 w-56" />
              )}
            </div>
            <p className="mt-2 text-base text-muted" data-testid="wallet-balance">
              {shown.balance !== null && shown.balanceDecimals !== null ? (
                <>
                  In your wallets: <span className="font-semibold text-ink tabular-nums">{formatAmount(shown.balance, shown.balanceDecimals)} {symbol}</span>
                </>
              ) : shown.balanceFailed ? (
                <span className="text-amber-ink">Couldn&apos;t load your balance. Trying again...</span>
              ) : (
                <Skeleton className="inline-block h-5 w-40 align-middle" />
              )}
            </p>
            {waitingLine && <p className="mt-2 text-lg">{waitingLine}</p>}
          </div>
        </div>
      )}

      <div className="mt-6">
        {!hasClients ? (
          <Button onClick={() => focusField("client-name")}>Add your first client</Button>
        ) : (
          <Button onClick={() => window.dispatchEvent(new Event(NEW_INVOICE_EVENT))}>New invoice</Button>
        )}
      </div>

      {!allDone && (
        <ol className="mt-8 flex flex-col gap-3 border-t border-line pt-6" aria-label="Getting started">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done[index] ? "bg-palm text-white" : "border-2 border-brand/40 text-brand"
                }`}
              >
                {done[index] ? <CheckIcon /> : index + 1}
              </span>
              <span className={done[index] ? "text-muted line-through decoration-muted/50" : "font-semibold"}>
                {label}
                {done[index] && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
