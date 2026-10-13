"use client";

import { formatAmount } from "@/lib/amount";
import { explorerTxUrl } from "@/lib/config";
import { formatElapsed } from "@/lib/format";
import type { PaidMoment as Moment } from "@/lib/receipts";
import { useDecimals } from "@/lib/useDecimals";

/** Full-width confirmation shown when a payment lands while the dashboard is open. */
export default function PaidMoment({ moment, onDismiss }: { moment: Moment; onDismiss: () => void }) {
  const decimals = useDecimals();
  const amountText = decimals === null ? "..." : formatAmount(moment.amount, decimals);
  const extraText = decimals === null ? "" : formatAmount(moment.extra, decimals);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="paid-moment-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-900 px-6 text-center text-white"
      data-testid="paid-moment"
    >
      <p className="text-6xl font-bold">Paid</p>
      <p id="paid-moment-title" className="mt-6 break-words text-3xl font-semibold">
        Paid by {moment.clientName}, {amountText} AUSD
      </p>
      {moment.extra > 0n && <p className="mt-3 text-xl">+{extraText} AUSD extra</p>}
      {moment.elapsedSeconds !== null && (
        <p className="mt-3 text-lg">
          {formatElapsed(moment.elapsedSeconds)} after you created the invoice
        </p>
      )}
      <a
        className="mt-6 inline-flex min-h-11 items-center text-lg underline"
        href={explorerTxUrl(moment.tx)}
        target="_blank"
        rel="noreferrer"
      >
        View transaction
      </a>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-8 min-h-11 rounded-lg bg-white px-8 text-lg font-medium text-green-900"
      >
        Done
      </button>
    </div>
  );
}
