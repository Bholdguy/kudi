"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Button, EmptyState, Field, Skeleton, buttonClass, inputClass } from "@/components/ui";
import { formatAmount } from "@/lib/amount";
import { buildClient, validateClientName } from "@/lib/clients";
import { config } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { loadState, saveState, type StoredClient, type StoredState } from "@/lib/store";
import type { BalancesState } from "@/lib/useBalances";

export type ClientRow = { client: StoredClient; address: string };

function UsersIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18.5 14.6c1.4.7 2.2 2 2.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function ClientsSection({
  state,
  rows,
  balanceState,
}: {
  state: StoredState;
  rows: ClientRow[];
  balanceState: BalancesState;
}) {
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { decimals, balances, failed } = balanceState;

  function check(raw: string): string | null {
    if (validateClientName(raw) !== null) return null;
    return raw.trim().length === 0
      ? "Enter a name for this client."
      : `Keep the name to ${config.displayNameMaxLength} characters or fewer.`;
  }

  function addClient(event: React.FormEvent) {
    event.preventDefault();
    const problem = check(nameInput);
    setError(problem);
    const name = validateClientName(nameInput);
    if (problem !== null || name === null) return;
    // Read the latest saved list so a fast double tap cannot reuse an index.
    const current = loadState() ?? state;
    const client = buildClient(
      current.accountXpub,
      current.clients,
      name,
      Math.floor(Date.now() / 1000),
    );
    saveState({ ...current, clients: [...current.clients, client] });
    setNameInput("");
    setTouched(false);
  }

  function balanceNode(address: string) {
    const value = balances[address];
    if (value === undefined || decimals === null) {
      return failed ? (
        <span className="text-sm text-amber-ink">Retrying...</span>
      ) : (
        <Skeleton className="h-6 w-24" />
      );
    }
    return (
      <span className="font-display text-xl font-semibold tabular-nums">
        {formatAmount(value, decimals)} <span className="text-base text-muted">AUSD</span>
      </span>
    );
  }

  return (
    <section className="mt-12" aria-labelledby="clients-heading">
      <h2 id="clients-heading" className="font-display text-2xl font-bold tracking-tight">
        Clients
      </h2>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<UsersIcon />} title="No clients yet">
            Add your first client to get a payment address just for them. You always know who paid.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {rows.map(({ client, address }) => (
            <li key={client.index} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{client.name}</p>
                <p className="text-sm tabular-nums text-muted" title={address}>
                  {shortAddress(address)}
                </p>
                <CopyButton
                  text={address}
                  label="Copy address"
                  className={buttonClass("quiet", "!px-0")}
                />
              </div>
              <div className="shrink-0 text-right" data-testid={`balance-${client.index}`}>
                <p className="text-sm text-muted">Received</p>
                {balanceNode(address)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {failed && rows.length > 0 && (
        <p role="status" className="mt-3 text-sm font-medium text-amber-ink">
          Network is busy, retrying...
        </p>
      )}

      <form onSubmit={addClient} className="mt-6 flex flex-col gap-3" noValidate>
        <Field
          id="client-name"
          label="Client name"
          hint="Only you see this. A company or a person works."
          error={error}
        >
          {(fieldProps) => (
            <div className="flex gap-3">
              <input
                {...fieldProps}
                type="text"
                value={nameInput}
                maxLength={config.displayNameMaxLength}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setTouched(true);
                  if (error) setError(null);
                }}
                onBlur={() => {
                  if (touched) setError(check(nameInput));
                }}
                className={`${inputClass} min-w-0 flex-1 ${error ? "border-clay" : "border-line"}`}
              />
              <Button type="submit">Add client</Button>
            </div>
          )}
        </Field>
      </form>
    </section>
  );
}
