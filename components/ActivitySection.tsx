"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton, buttonClass } from "@/components/ui";
import { recentActivity } from "@/lib/activity";
import { formatAmount } from "@/lib/amount";
import { explorerTxUrl } from "@/lib/config";
import { formatElapsed } from "@/lib/format";
import type { StoredState } from "@/lib/store";
import { useDecimals } from "@/lib/useDecimals";

const TICK_MS = 30_000;

function ClockIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The last incoming payments across all clients (KUDI-18). */
export default function ActivitySection({ state }: { state: StoredState }) {
  const decimals = useDecimals();
  const items = useMemo(() => recentActivity(state.clients), [state.clients]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="mt-12" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="font-display text-2xl font-bold tracking-tight">
        Recent payments
      </h2>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<ClockIcon />} title="No payments yet">
            When a client pays, it shows up here, even if it doesn&apos;t match an invoice.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line" data-testid="activity-list">
          {items.map((item) => (
            <li key={`${item.tx}:${item.logIndex}`} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{item.clientName}</p>
                <p className="text-sm text-muted">
                  {item.timestamp > 0 ? `${formatElapsed(now - item.timestamp)} ago` : "Just now"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {decimals === null ? (
                  <Skeleton className="ml-auto h-6 w-24" />
                ) : (
                  <p className="font-display text-xl font-semibold tabular-nums text-palm">
                    +{formatAmount(BigInt(item.value), decimals)}{" "}
                    <span className="text-base text-muted">AUSD</span>
                  </p>
                )}
                <a
                  className={buttonClass("quiet", "!min-h-11")}
                  href={explorerTxUrl(item.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
