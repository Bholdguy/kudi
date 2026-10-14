"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { readArcNativeBalance } from "@/lib/arcChain";
import { config } from "@/lib/config";
import { nextFailureCount, showBusyMessage } from "@/lib/retry";

export type ArcBalancesState = {
  /** Native USDC balances in wei (18 decimals) by address. Missing until the first read. */
  balances: Readonly<Record<string, bigint>>;
  /** True when the latest refresh failed. Last known values stay in `balances`. */
  failed: boolean;
};

/**
 * Reads the native Arc balance of each address now and every
 * `config.balanceRefreshMs` while the page is open. Pauses while the tab is hidden.
 */
export function useArcBalances(addresses: readonly string[]): ArcBalancesState {
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [failed, setFailed] = useState(false);
  const key = addresses.join(",");

  useEffect(() => {
    if (key === "") return;
    const list = key.split(",");
    let cancelled = false;
    let inFlight = false;
    let failures = 0;

    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const values = await Promise.all(list.map((address) => readArcNativeBalance(address as Address)));
        if (cancelled) return;
        setBalances((previous) => ({
          ...previous,
          ...Object.fromEntries(list.map((address, i) => [address, values[i]])),
        }));
        failures = nextFailureCount(failures, true);
        setFailed(false);
      } catch {
        failures = nextFailureCount(failures, false);
        if (!cancelled) setFailed(showBusyMessage(failures));
      } finally {
        inFlight = false;
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) void refresh();
    }

    void refresh();
    const timer = setInterval(() => void refresh(), config.balanceRefreshMs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [key]);

  return { balances, failed };
}
