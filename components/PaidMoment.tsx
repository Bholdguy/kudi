"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount } from "@/lib/amount";
import { explorerTxUrl } from "@/lib/config";
import { NETWORKS } from "@/lib/chains";
import { formatElapsed } from "@/lib/format";
import type { PaidMoment as Moment } from "@/lib/receipts";

const COUNT_UP_MS = 900;
const CONFETTI_COLOURS = ["#f4b22b", "#ffffff", "#7fe0b8", "#aab4ff"];
const CONFETTI_COUNT = 28;

/** 0 up to `value` in whole base units, easing out. Always ends on exactly `value`. */
function useCountUp(value: bigint): bigint {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState<bigint>(reduced ? value : 0n);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(progress >= 1 ? value : (value * BigInt(Math.round(eased * 1000))) / 1000n);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return shown;
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const size = 8 + ((i * 5) % 9);
        return (
          <span
            key={i}
            className="confetti-piece absolute top-0 block animate-confetti"
            style={
              {
                left: `${(i * 37 + 11) % 100}%`,
                width: size,
                height: i % 3 === 0 ? size : size * 1.7,
                borderRadius: i % 3 === 0 ? "50%" : "2px",
                background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
                animationDelay: `${(i % 7) * 0.13}s`,
                animationDuration: `${2.2 + (i % 5) * 0.28}s`,
                "--drift": `${((i % 9) - 4) * 14}px`,
                "--spin": `${360 + (i % 4) * 120}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/**
 * Full-screen confirmation for a payment that lands while the dashboard is open.
 * Everything shown is real: the client and freelancer names and the amounts
 * come from the stored invoice and the chain, and `decimals` is required so the
 * amount is never shown before it is known.
 */
export default function PaidMoment({
  moment,
  decimals,
  freelancerName,
  onDismiss,
}: {
  moment: Moment;
  decimals: number;
  freelancerName: string;
  onDismiss: () => void;
}) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const network = moment.network ?? "monad";
  const symbol = NETWORKS[network].token.symbol;
  const finalAmount = formatAmount(moment.amount, decimals);
  const shownAmount = formatAmount(useCountUp(moment.amount), decimals);

  useEffect(() => {
    doneRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navigator.vibrate?.([70, 40, 140]);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="paid-moment-title"
      className="adire-dark on-dark fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-brand-deep px-6 text-center text-white"
      data-testid="paid-moment"
    >
      {/* Blurred indigo and marigold shapes behind the glass panel, for it to refract. */}
      <span className="pointer-events-none absolute -left-24 top-[8%] h-72 w-72 rounded-full bg-[#4a5bff]/60 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-20 bottom-[6%] h-72 w-72 rounded-full bg-coin/55 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute left-[30%] top-[2%] h-40 w-40 rounded-full bg-coin/35 blur-3xl" aria-hidden="true" />

      <Confetti />

      <div className="glass-dark relative z-10 flex w-full max-w-sm flex-col items-center rounded-[2rem] px-6 py-8">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-coin animate-ring" aria-hidden="true" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-coin text-brand-deep shadow-[0_8px_30px_rgba(244,178,43,0.45)] animate-coin-pop">
          <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m5 12.5 4.6 4.6L19 7.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {freelancerName !== "" && (
        <p className="mt-6 text-lg text-white/85 animate-rise">Well done, {freelancerName}.</p>
      )}
      <p className="mt-1 font-display text-7xl font-bold tracking-tight animate-rise">Paid</p>

      <p id="paid-moment-title" className="mt-4 max-w-[22ch] break-words font-display text-3xl font-semibold leading-tight animate-rise sm:max-w-[30ch]">
        <span className="sr-only">
          Paid by {moment.clientName}, {finalAmount} {symbol}
        </span>
        <span aria-hidden="true" className="tabular-nums">
          Paid by {moment.clientName}, {shownAmount} {symbol}
        </span>
      </p>

      {moment.extra > 0n && (
        <p className="mt-3 text-xl font-semibold text-coin">+{formatAmount(moment.extra, decimals)} {symbol} extra</p>
      )}
      {moment.elapsedSeconds !== null && (
        <p className="mt-3 text-lg text-white/85">
          {formatElapsed(moment.elapsedSeconds)} after you created the invoice
        </p>
      )}

      <a
        className="mt-6 inline-flex min-h-11 items-center text-lg font-semibold underline decoration-white/60 underline-offset-4"
        href={explorerTxUrl(moment.tx, network)}
        target="_blank"
        rel="noreferrer"
      >
        View transaction
      </a>
      <button
        ref={doneRef}
        type="button"
        onClick={onDismiss}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-10 text-lg font-semibold text-brand-deep hover:bg-coin"
      >
        Done
      </button>
      </div>
    </div>
  );
}
