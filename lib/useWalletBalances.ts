"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { readBalances, readNativeBalance } from "@/lib/ausd";
import { config } from "@/lib/config";

export type WalletBalances = {
  ausd: bigint | null;
  mon: bigint | null;
  /** True when the latest refresh failed. Last known values are kept. */
  failed: boolean;
};

/** AUSD and native balances of the connected account, refreshed while the page is open. */
export function useWalletBalances(account: Address | null): WalletBalances {
  const [state, setState] = useState<{ account: Address; ausd: bigint; mon: bigint } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (account === null) return;
    let cancelled = false;
    let inFlight = false;

    async function refresh(address: Address) {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const [[ausd], mon] = await Promise.all([readBalances([address]), readNativeBalance(address)]);
        if (cancelled) return;
        setState({ account: address, ausd, mon });
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        inFlight = false;
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) void refresh(account as Address);
    }

    void refresh(account);
    const timer = setInterval(() => void refresh(account), config.balanceRefreshMs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [account]);

  const current = state !== null && state.account === account ? state : null;
  return { ausd: current?.ausd ?? null, mon: current?.mon ?? null, failed };
}
