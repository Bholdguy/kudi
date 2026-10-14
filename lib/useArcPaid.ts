"use client";

import { useEffect, useState } from "react";
import type { Hash, Hex } from "viem";
import { arcInvoiceId } from "@/lib/arcPay";
import { findArcPaymentTx, readArcPaid } from "@/lib/arcChain";
import { config } from "@/lib/config";
import type { PayLink } from "@/lib/invoice";

export type ArcPaidState = { paid: boolean; hash: Hash | null };

const UNPAID: ArcPaidState = { paid: false, hash: null };

/**
 * Whether an Arc invoice is paid, from KudiPay.paid(invoiceId), checked on
 * load and every `config.arcPollMs` until it is. The transaction hash comes
 * from the InvoicePaid log and is looked up again until it is found.
 */
export function useArcPaid(link: PayLink): ArcPaidState {
  const [state, setState] = useState<ArcPaidState>(UNPAID);

  useEffect(() => {
    if (link.network !== "arc" || link.salt === null) return;
    const invoiceId: Hex = arcInvoiceId(link.to, link.amt, link.salt as Hex);
    let cancelled = false;
    let paid = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        if (!paid) paid = await readArcPaid(invoiceId);
        if (cancelled) return;
        if (paid) {
          setState({ paid: true, hash: null });
          const found = await findArcPaymentTx(invoiceId, link.b);
          if (cancelled) return;
          if (found) {
            setState({ paid: true, hash: found.hash });
            return;
          }
        }
      } catch {
        // Keep polling: the read or the log lookup can fail while the network is busy.
      }
      if (!cancelled) timer = setTimeout(check, config.arcPollMs);
    }

    void check();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [link.network, link.to, link.amt, link.salt, link.b]);

  return link.network === "arc" ? state : UNPAID;
}
