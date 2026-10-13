"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { getDecimals, readBalances } from "@/lib/ausd";
import { config } from "@/lib/config";

export type BalancesState = {
  decimals: number | null;
  /** AUSD base units by address. An address is missing until its first read. */
  balances: Readonly<Record<string, bigint>>;
  /** True when the latest refresh failed. Last known values stay in `balances`. */
  failed: boolean;
};

/**
 * Reads AUSD balances now and every `config.balanceRefreshMs` while the page
 * is open. Refresh pauses while the tab is hidden and runs on return.
 */
export function useBalances(addresses: readonly string[]): BalancesState {
  const [decimals, setDecimals] = useState<number | null>(null);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [failed, setFailed] = useState(false);
  const key = addresses.join(",");

  useEffect(() => {
    if (key === "") return;
    const list = key.split(",");
    let cancelled = false;
    let inFlight = false;

    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const [nextDecimals, values] = await Promise.all([
          getDecimals(),
          readBalances(list as Address[]),
        ]);
        if (cancelled) return;
        setDecimals(nextDecimals);
        setBalances((previous) => ({
          ...previous,
          ...Object.fromEntries(list.map((address, i) => [address, values[i]])),
        }));
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
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

  return { decimals, balances, failed };
}
