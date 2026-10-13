"use client";

import { useCallback, useEffect, useState } from "react";
import { config } from "@/lib/config";
import { scanPass, type PaidMoment } from "@/lib/receipts";
import { nextFailureCount, showBusyMessage } from "@/lib/retry";

export type PaymentWatcher = {
  /** True until the first full pass has reached the chain's latest block. */
  checking: boolean;
  /** True when the latest pass could not read the chain. */
  failed: boolean;
  /** Payments that arrived while this page was open and caught up, oldest first. */
  moments: PaidMoment[];
  dismissFirst: () => void;
};

/**
 * Looks for incoming payments while the page is open: a catch-up pass on
 * load, then a pass every `config.scanPollMs`. It pauses while the tab is
 * hidden; the next pass after it returns covers the whole gap in windows.
 * A payment found during the catch-up is shown in the list only. One found
 * afterwards also becomes a full-screen moment.
 */
export function usePaymentWatcher(): PaymentWatcher {
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [moments, setMoments] = useState<PaidMoment[]>([]);

  useEffect(() => {
    let cancelled = false;
    let caughtUp = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function pause(ms: number): Promise<void> {
      return new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      });
    }

    async function loop() {
      while (!cancelled) {
        if (!document.hidden) {
          try {
            const outcome = await scanPass(caughtUp);
            if (cancelled) return;
            if (outcome.moments.length > 0) setMoments((previous) => [...previous, ...outcome.moments]);
            if (outcome.reachedHead) caughtUp = true;
            setChecking(!caughtUp);
            failures = nextFailureCount(failures, true);
            setFailed(false);
          } catch {
            if (cancelled) return;
            failures = nextFailureCount(failures, false);
            setFailed(showBusyMessage(failures));
          }
        }
        await pause(config.scanPollMs);
      }
    }

    void loop();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  const dismissFirst = useCallback(() => setMoments((previous) => previous.slice(1)), []);

  return { checking, failed, moments, dismissFirst };
}
