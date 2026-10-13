"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import NameForm from "@/components/NameForm";
import { Button, buttonClass } from "@/components/ui";
import { shortAddress } from "@/lib/format";
import type { StoredState } from "@/lib/store";

/** The quiet part of the dashboard: who the invoices are from and the account's home address. */
export default function AccountSection({ state }: { state: StoredState }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="mt-12 border-t border-line pt-8" aria-labelledby="account-heading">
      <h2 id="account-heading" className="font-display text-2xl font-bold tracking-tight">
        Your account
      </h2>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Name on invoices</p>
          <p className="text-lg font-semibold">{state.displayName}</p>
        </div>
        {!editing && (
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Change name
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-4">
          <NameForm
            initial={state.displayName}
            submitLabel="Save name"
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm text-muted">Your account address</p>
        <p className="mt-0.5 text-sm text-muted">
          Your own address. Each client has a separate one in the list above.
        </p>
        <p className="mt-2 font-semibold tabular-nums" title={state.homeAddress} data-testid="home-address">
          {shortAddress(state.homeAddress)}
        </p>
        <div className="mt-2">
          <CopyButton text={state.homeAddress} label="Copy address" className={buttonClass("secondary")} />
        </div>
      </div>
    </section>
  );
}
