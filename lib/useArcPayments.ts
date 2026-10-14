"use client";

import { useCallback, useEffect, useState } from "react";
import { checkArcInvoices } from "@/lib/arcWatch";
import { config } from "@/lib/config";
import type { PaidMoment } from "@/lib/receipts";

export type ArcPaymentWatcher = {
  /** Arc payments that arrived while this page was open, oldest first. */
  moments: PaidMoment[];
  dismissFirst: () => void;
};

/**
 * Polls open Arc invoices every `config.arcPollMs` while the tab is visible.
 * The first pass only updates the list. Later passes also raise a full-screen
 * moment for each payment, like the AUSD watcher does.
 */
export function useArcPayments(): ArcPaymentWatcher {
  const [moments, setMoments] = useState<PaidMoment[]>([]);

  useEffect(() => {
    let cancelled = false;
    let caughtUp = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pass() {
      if (!document.hidden) {
        try {
          const flipped = await checkArcInvoices();
          if (cancelled) return;
          if (caughtUp && flipped.length > 0) setMoments((previous) => [...previous, ...flipped]);
          caughtUp = true;
        } catch {
          // Retry on the next pass; the list keeps its last state.
        }
      }
      if (!cancelled) timer = setTimeout(() => void pass(), config.arcPollMs);
    }

    void pass();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  const dismissFirst = useCallback(() => setMoments((previous) => previous.slice(1)), []);

  return { moments, dismissFirst };
}
