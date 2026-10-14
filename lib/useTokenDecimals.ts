"use client";

import { useEffect, useState } from "react";
import type { NetworkKey } from "@/lib/chains";
import { config } from "@/lib/config";
import { getTokenDecimals, peekTokenDecimals } from "@/lib/chainReads";

/** A network's token decimals read from its contract. Null until the read succeeds; retries until it does. */
export function useTokenDecimals(network: NetworkKey): number | null {
  const [loaded, setLoaded] = useState<{ network: NetworkKey; value: number } | null>(null);
  const cached = peekTokenDecimals(network);

  useEffect(() => {
    if (peekTokenDecimals(network) !== null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      getTokenDecimals(network)
        .then((value) => {
          if (!cancelled) setLoaded({ network, value });
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
  }, [network]);

  if (cached !== null) return cached;
  return loaded !== null && loaded.network === network ? loaded.value : null;
}
