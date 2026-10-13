"use client";

import NameForm from "@/components/NameForm";
import { Button, CheckIcon, Skeleton } from "@/components/ui";
import { formatAmount } from "@/lib/amount";
import { NEW_INVOICE_EVENT } from "@/lib/events";
import type { StoredState } from "@/lib/store";

type SummaryProps = {
  state: StoredState;
  /** Sum of every client's AUSD balance, base units. Null until all are read. */
  total: bigint | null;
  decimals: number | null;
  balancesFailed: boolean;
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

/** Top of the dashboard: who you are, what you've received, what's next. */
export default function Summary({ state, total, decimals, balancesFailed }: SummaryProps) {
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

  return (
    <section className="pt-6" aria-labelledby="summary-heading">
      <h1 id="summary-heading" className="font-display text-4xl font-bold leading-tight tracking-tight">
        Hi, {state.displayName}
      </h1>

      {hasClients && (
        <div className="mt-4">
          <p className="text-muted">You&apos;ve received</p>
          <div className="mt-1 min-h-[3.25rem]" data-testid="total-received">
            {total !== null && decimals !== null ? (
              <p className="font-display text-5xl font-bold tabular-nums tracking-tight">
                {formatAmount(total, decimals)}
                <span className="ml-2 text-2xl font-semibold text-muted">AUSD</span>
              </p>
            ) : balancesFailed ? (
              <p className="text-base text-amber-ink">Couldn&apos;t load your total. Trying again...</p>
            ) : (
              <Skeleton className="h-12 w-56" />
            )}
          </div>
          {waitingLine && <p className="mt-2 text-lg">{waitingLine}</p>}
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
