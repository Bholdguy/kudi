"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { formatAmount } from "@/lib/amount";
import { shortAddress } from "@/lib/format";
import { parsePayLink } from "@/lib/invoice";
import { useDecimals } from "@/lib/useDecimals";

export default function PayView() {
  const params = useSearchParams();
  const parsed = useMemo(() => parsePayLink(params), [params]);
  const decimals = useDecimals();

  if (!parsed.ok) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Kudi</h1>
        <p role="alert" className="mt-6 text-lg">
          This invoice link is broken. Ask for a new one.
        </p>
      </main>
    );
  }

  const { link } = parsed;
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Kudi</h1>
      <p className="mt-6 text-zinc-700">Invoice from</p>
      <p className="text-xl font-semibold" data-testid="pay-from">
        {link.n}
      </p>
      {link.c !== "" && (
        <p className="mt-1 text-zinc-700" data-testid="pay-client">
          For {link.c}
        </p>
      )}

      <p className="mt-6 text-sm text-zinc-700">Amount</p>
      <p className="font-mono text-3xl" data-testid="pay-amount">
        {decimals === null ? "Loading..." : `${formatAmount(link.amt, decimals)} AUSD`}
      </p>

      {link.m !== "" && (
        <>
          <p className="mt-6 text-sm text-zinc-700">Note</p>
          <p className="break-words" data-testid="pay-memo">
            {link.m}
          </p>
        </>
      )}

      <p className="mt-6 text-sm text-zinc-700">Receiving address</p>
      <p className="font-mono" title={link.to} data-testid="pay-to">
        {shortAddress(link.to)}
      </p>

      <p className="mt-8 text-xs text-zinc-600" data-testid="pay-details">
        Invoice {link.inv}, created at block {link.b}
      </p>
    </main>
  );
}
