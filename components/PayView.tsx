"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Address, Hash } from "viem";
import { Logo } from "@/components/BrandMark";
import { AlertIcon, Button, CheckIcon, Skeleton, Spinner } from "@/components/ui";
import { formatAmount } from "@/lib/amount";
import { config, explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { parsePayLink, type PayLink } from "@/lib/invoice";
import { checkPayment } from "@/lib/payment";
import { useDecimals } from "@/lib/useDecimals";
import { useWalletBalances } from "@/lib/useWalletBalances";
import {
  connectWallet,
  ensureCorrectChain,
  getConnectedAccount,
  getProvider,
  getWalletChainId,
  isRequestAlreadyPending,
  isUserRejection,
  sendPayment,
  waitForPayment,
} from "@/lib/wallet";

type ButtonKind = "connect" | "switch" | "pay";

type FailureReason =
  | "connect_rejected"
  | "connect_failed"
  | "request_pending"
  | "rejected"
  | "reverted"
  | "other";

type Phase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "switching" }
  | { kind: "sending" }
  | { kind: "confirming"; hash: Hash }
  | { kind: "unconfirmed"; hash: Hash }
  | { kind: "paid"; hash: Hash }
  | { kind: "failed"; reason: FailureReason; hash?: Hash };

const FAILURE_MESSAGE: Record<FailureReason, string> = {
  connect_rejected: "Connection cancelled. Tap to try again.",
  connect_failed: "Could not connect to your wallet. Try again.",
  request_pending: "Your wallet already has a request waiting. Open it to continue.",
  rejected: "Payment cancelled. Nothing was sent.",
  reverted: "Payment failed on-chain. Nothing was sent.",
  other: "Something went wrong. Nothing was sent. Try again.",
};

const linkClass = "inline-flex min-h-11 items-center text-base font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

function subscribeProvider(onChange: () => void) {
  window.addEventListener("ethereum#initialized", onChange);
  return () => window.removeEventListener("ethereum#initialized", onChange);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto w-full max-w-lg px-5 pt-5">
        <Logo size={30} />
      </header>
      <main className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">{children}</main>
    </div>
  );
}

export default function PayView() {
  const params = useSearchParams();
  const parsed = useMemo(() => parsePayLink(params), [params]);

  if (!parsed.ok) {
    return (
      <Shell>
        <div className="flex items-start gap-3 rounded-2xl bg-clay-soft p-5" role="alert">
          <AlertIcon className="mt-1 h-5 w-5 shrink-0 text-clay" />
          <div>
            <h1 className="font-display text-2xl font-bold text-clay">This invoice link is broken.</h1>
            <p className="mt-1 text-lg">Ask for a new one.</p>
          </div>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <PayInvoice link={parsed.link} />
    </Shell>
  );
}

function PayInvoice({ link }: { link: PayLink }) {
  const decimals = useDecimals();
  const provider = useSyncExternalStore(subscribeProvider, getProvider, () => null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = useRef(false);
  const balances = useWalletBalances(account);

  useEffect(() => {
    if (provider === null) return;
    let cancelled = false;
    getConnectedAccount(provider)
      .then((connected) => {
        if (!cancelled) setAccount(connected);
      })
      .catch(() => {});
    getWalletChainId(provider)
      .then((id) => {
        if (!cancelled) setChainId(id);
      })
      .catch(() => {});

    const onAccounts = (accounts: Address[]) => setAccount(accounts[0] ?? null);
    const onChain = (id: string) => setChainId(Number(id));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      cancelled = true;
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
    };
  }, [provider]);

  const check = checkPayment({
    hasProvider: provider !== null,
    account,
    chainId,
    ausd: balances.ausd,
    mon: balances.mon,
    amount: link.amt,
  });

  const amountOnly = decimals === null ? null : formatAmount(link.amt, decimals);
  const amountText = amountOnly === null ? null : `${amountOnly} AUSD`;

  async function runExclusive(task: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  }

  async function switchNetwork() {
    if (provider === null) return;
    setPhase({ kind: "switching" });
    await ensureCorrectChain(provider);
    setChainId(await getWalletChainId(provider));
    setPhase({ kind: "idle" });
  }

  function connectionFailure(error: unknown): Phase {
    return {
      kind: "failed",
      reason: isUserRejection(error)
        ? "connect_rejected"
        : isRequestAlreadyPending(error)
          ? "request_pending"
          : "connect_failed",
    };
  }

  function connectAndSwitch() {
    if (provider === null) return;
    void runExclusive(async () => {
      setPhase({ kind: "connecting" });
      try {
        setAccount(await connectWallet(provider));
        const id = await getWalletChainId(provider);
        setChainId(id);
        if (id !== config.chain.id) await switchNetwork();
        else setPhase({ kind: "idle" });
      } catch (error) {
        setPhase(connectionFailure(error));
      }
    });
  }

  function switchOnly() {
    void runExclusive(async () => {
      try {
        await switchNetwork();
      } catch (error) {
        setPhase(connectionFailure(error));
      }
    });
  }

  function pay() {
    if (provider === null || account === null) return;
    void runExclusive(async () => {
      setPhase({ kind: "sending" });
      let hash: Hash | undefined;
      try {
        hash = await sendPayment({ provider, account, to: link.to, amount: link.amt });
        setPhase({ kind: "confirming", hash });
        const result = await waitForPayment(hash);
        setPhase(
          result === "success" ? { kind: "paid", hash } : { kind: "failed", reason: "reverted", hash },
        );
      } catch (error) {
        if (hash !== undefined) setPhase({ kind: "unconfirmed", hash });
        else setPhase({ kind: "failed", reason: isUserRejection(error) ? "rejected" : "other" });
      }
    });
  }

  function checkAgain(hash: Hash) {
    void runExclusive(async () => {
      setPhase({ kind: "confirming", hash });
      try {
        const result = await waitForPayment(hash);
        setPhase(
          result === "success" ? { kind: "paid", hash } : { kind: "failed", reason: "reverted", hash },
        );
      } catch {
        setPhase({ kind: "unconfirmed", hash });
      }
    });
  }

  const sending = phase.kind === "sending" || phase.kind === "confirming";
  const retryLabel =
    phase.kind === "failed" && ["rejected", "reverted", "other"].includes(phase.reason);

  let button: { label: string; disabled: boolean; kind: ButtonKind; working?: boolean } | null = null;
  if (phase.kind === "paid" || phase.kind === "unconfirmed" || check.action === "no_wallet") {
    button = null;
  } else if (phase.kind === "connecting") {
    button = { label: "Connecting...", disabled: true, kind: "connect", working: true };
  } else if (phase.kind === "switching") {
    button = { label: "Switching network...", disabled: true, kind: "switch", working: true };
  } else if (sending) {
    button = { label: "Sending...", disabled: true, kind: "pay", working: true };
  } else if (check.action === "not_connected") {
    button = {
      label: amountText ? `Connect wallet to pay ${amountText}` : "Connect wallet to pay",
      disabled: false,
      kind: "connect",
    };
  } else if (check.action === "wrong_chain") {
    button = { label: `Switch to ${config.chain.name}`, disabled: false, kind: "switch" };
  } else if (check.action === "checking") {
    button = { label: "Checking balances...", disabled: true, kind: "pay", working: true };
  } else if (check.action === "low_ausd") {
    button = { label: "Not enough AUSD", disabled: true, kind: "pay" };
  } else if (check.action === "low_mon") {
    button = { label: "Add testnet MON for gas", disabled: true, kind: "pay" };
  } else {
    button = {
      label: retryLabel ? "Try again" : amountText ? `Pay ${amountText}` : "Loading...",
      disabled: decimals === null,
      kind: "pay",
    };
  }
  const activeButton = button;

  function onButtonClick(kind: ButtonKind) {
    if (kind === "connect") connectAndSwitch();
    else if (kind === "switch") switchOnly();
    else pay();
  }

  const paid = phase.kind === "paid";

  return (
    <>
      <p className="text-lg text-muted">Invoice from</p>
      <h1 className="font-display text-4xl font-bold leading-tight tracking-tight" data-testid="pay-from">
        {link.n}
      </h1>
      {link.c !== "" && (
        <p className="mt-1 text-lg text-muted" data-testid="pay-client">
          For {link.c}
        </p>
      )}

      <div className="mt-8" data-testid="pay-amount">
        {amountOnly === null ? (
          <Skeleton className="h-14 w-60" />
        ) : (
          <p className="font-display text-6xl font-bold tabular-nums tracking-tight">
            {amountOnly}
            <span className="ml-2 text-3xl font-semibold text-muted">AUSD</span>
          </p>
        )}
      </div>

      <dl className="mt-8 divide-y divide-line border-y border-line">
        {link.m !== "" && (
          <div className="py-3">
            <dt className="text-sm text-muted">Note</dt>
            <dd className="mt-0.5 break-words text-lg" data-testid="pay-memo">
              {link.m}
            </dd>
          </div>
        )}
        <div className="py-3">
          <dt className="text-sm text-muted">Receiving address</dt>
          <dd className="mt-0.5 break-all font-semibold" title={link.to} data-testid="pay-to">
            {link.to}
          </dd>
          <dd className="mt-1 text-sm text-muted">Check that this matches what {link.n} told you.</dd>
          <dd>
            <a className={linkClass} href={explorerAddressUrl(link.to)} target="_blank" rel="noreferrer">
              View on explorer
            </a>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        A small network fee, paid in testnet MON, applies when you send.
      </p>

      <section className="mt-8" aria-live="polite">
        {paid ? (
          <div className="rounded-3xl bg-palm-soft p-6 text-center" data-testid="pay-paid">
            <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-palm/25 animate-ring" aria-hidden="true" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-palm text-white animate-coin-pop">
                <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 12.5 4.6 4.6L19 7.5"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="24"
                    strokeDashoffset="24"
                    className="animate-draw"
                  />
                </svg>
              </span>
            </span>
            <p className="mt-4 font-display text-4xl font-bold text-palm">Paid</p>
            <p className="mt-1 text-lg">
              {amountText} sent to {link.n}.
            </p>
            <p className="mt-3 text-muted">You can close this page. {link.n} will see the payment on their dashboard.</p>
            <a
              className={`${linkClass} mt-2`}
              href={explorerTxUrl(phase.hash)}
              target="_blank"
              rel="noreferrer"
              data-testid="pay-tx-link"
            >
              View transaction
            </a>
          </div>
        ) : (
          <>
            {check.action === "no_wallet" && (
              <div role="alert" className="rounded-2xl bg-brand-soft p-4" data-testid="pay-no-wallet">
                <p className="text-lg font-semibold">
                  Open this link in a browser with a crypto wallet, like MetaMask.
                </p>
              </div>
            )}

            {account !== null && check.action !== "no_wallet" && (
              <p className="mb-3 text-sm text-muted">
                Connected as {shortAddress(account)}
                {balances.ausd !== null && decimals !== null
                  ? `. Your balance: ${formatAmount(balances.ausd, decimals)} AUSD.`
                  : "."}
              </p>
            )}

            {activeButton && (
              <Button
                className="w-full !min-h-14 text-lg"
                disabled={activeButton.disabled}
                onClick={() => onButtonClick(activeButton.kind)}
                data-testid="pay-button"
              >
                {activeButton.working && <Spinner />}
                {activeButton.label}
              </Button>
            )}

            {sending && (
              <p role="status" className="mt-3 text-muted">
                Waiting for confirmation. This takes a few seconds. Keep this page open.
              </p>
            )}

            {check.lowMon && check.action !== "no_wallet" && (
              <div className="mt-3 text-sm">
                <p>You need a little testnet MON to send a payment.</p>
                <a className={linkClass} href={config.monFaucetUrl} target="_blank" rel="noreferrer">
                  Get testnet MON
                </a>
              </div>
            )}

            {balances.failed && (
              <p role="status" className="mt-3 text-sm font-medium text-amber-ink">
                Network is busy, retrying...
              </p>
            )}

            {phase.kind === "failed" && (
              <div role="alert" className="mt-3 flex items-start gap-2 text-base font-medium text-clay">
                <AlertIcon className="mt-1 h-4 w-4 shrink-0" />
                <div>
                  <p>{FAILURE_MESSAGE[phase.reason]}</p>
                  {phase.hash !== undefined && (
                    <a className={linkClass} href={explorerTxUrl(phase.hash)} target="_blank" rel="noreferrer">
                      View transaction
                    </a>
                  )}
                </div>
              </div>
            )}

            {phase.kind === "unconfirmed" && (
              <div role="alert" className="rounded-2xl bg-amber-soft p-4 text-amber-ink">
                <p className="font-semibold">
                  Your payment was sent but is not confirmed yet. Do not pay again. Check the
                  transaction, or tap Check again.
                </p>
                <a className={linkClass} href={explorerTxUrl(phase.hash)} target="_blank" rel="noreferrer">
                  View transaction
                </a>
                <Button className="mt-2 w-full" onClick={() => checkAgain(phase.hash)}>
                  <CheckIcon /> Check again
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="mt-10 text-xs text-muted" data-testid="pay-details">
        Invoice {link.inv}, created at block {link.b}
      </p>
    </>
  );
}
