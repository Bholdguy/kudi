"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { readArcNativeBalance } from "@/lib/arcChain";
import { config } from "@/lib/config";

/** The payer's native USDC balance on Arc in wei, refreshed while the page is open. Null until read. */
export function useArcBalance(account: Address | null): bigint | null {
  const [loaded, setLoaded] = useState<{ account: Address; value: bigint } | null>(null);

  useEffect(() => {
    if (account === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      readArcNativeBalance(account as Address)
        .then((value) => {
          if (cancelled) return;
          setLoaded({ account: account as Address, value });
          timer = setTimeout(load, config.balanceRefreshMs);
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(load, config.balanceRefreshMs);
        });
    }

    load();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [account]);

  if (account === null || loaded === null || loaded.account !== account) return null;
  return loaded.value;
}
