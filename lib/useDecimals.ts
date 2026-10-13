"use client";

import { useEffect, useState } from "react";
import { getDecimals } from "@/lib/ausd";
import { config } from "@/lib/config";

/** AUSD decimals read from the contract. Null until the read succeeds; retries until it does. */
export function useDecimals(): number | null {
  const [decimals, setDecimals] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      getDecimals()
        .then((value) => {
          if (!cancelled) setDecimals(value);
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
  }, []);

  return decimals;
}
