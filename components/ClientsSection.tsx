"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { formatAmount } from "@/lib/amount";
import { buildClient, clientAddress, validateClientName } from "@/lib/clients";
import { config } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { loadState, saveState, type StoredState } from "@/lib/store";
import { useBalances } from "@/lib/useBalances";

const primaryButton =
  "min-h-11 rounded-lg bg-black px-4 text-base font-medium text-white disabled:opacity-60";
const copyButton = "min-h-11 px-2 text-sm text-zinc-700 underline";

export default function ClientsSection({ state }: { state: StoredState }) {
  const [nameInput, setNameInput] = useState("");

  const rows = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        address: clientAddress(state.accountXpub, client),
      })),
    [state.clients, state.accountXpub],
  );
  const { decimals, balances, failed } = useBalances(rows.map((row) => row.address));

  const validName = validateClientName(nameInput);

  function addClient(event: React.FormEvent) {
    event.preventDefault();
    if (validName === null) return;
    // Read the latest saved list so a fast double tap cannot reuse an index.
    const current = loadState() ?? state;
    const client = buildClient(
      current.accountXpub,
      current.clients,
      validName,
      Math.floor(Date.now() / 1000),
    );
    saveState({ ...current, clients: [...current.clients, client] });
    setNameInput("");
  }

  const allKnown = rows.length > 0 && rows.every((row) => balances[row.address] !== undefined);
  const total = allKnown ? rows.reduce((sum, row) => sum + balances[row.address], 0n) : null;

  function balanceText(address: string): string {
    const value = balances[address];
    return value === undefined || decimals === null
      ? "Loading..."
      : `${formatAmount(value, decimals)} AUSD`;
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Clients</h2>

      <form onSubmit={addClient} className="mt-3 flex flex-col gap-3">
        <label htmlFor="client-name" className="text-base font-medium">
          Client name
        </label>
        <div className="flex gap-3">
          <input
            id="client-name"
            type="text"
            value={nameInput}
            maxLength={config.displayNameMaxLength}
            onChange={(e) => setNameInput(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-400 px-3 text-base"
          />
          <button type="submit" className={primaryButton} disabled={validName === null}>
            Add client
          </button>
        </div>
      </form>

      {failed && (
        <p role="status" className="mt-4 text-sm text-amber-900">
          Network is busy, retrying...
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-zinc-700">
          No clients yet. Add one to get a payment address just for them.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-zinc-700">Received, in dollars (AUSD)</p>
          <ul className="mt-2 divide-y divide-zinc-300 rounded-lg border border-zinc-300">
            {rows.map(({ client, address }) => (
              <li key={client.index} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.name}</p>
                  <p className="font-mono text-sm text-zinc-700" title={address}>
                    {shortAddress(address)}
                  </p>
                  <CopyButton text={address} label="Copy address" className={copyButton} />
                </div>
                <p className="shrink-0 font-mono text-base" data-testid={`balance-${client.index}`}>
                  {balanceText(address)}
                </p>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-zinc-50 p-4 font-semibold">
              <span>Total</span>
              <span className="font-mono" data-testid="balance-total">
                {total === null || decimals === null
                  ? "Loading..."
                  : `${formatAmount(total, decimals)} AUSD`}
              </span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
