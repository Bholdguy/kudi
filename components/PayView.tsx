"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Address, Hash } from "viem";
import { formatAmount } from "@/lib/amount";
import { config, explorerTxUrl } from "@/lib/config";
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

const buttonClass =
  "min-h-11 w-full rounded-lg bg-black px-4 text-base font-medium text-white disabled:opacity-60";
const linkClass = "inline-flex min-h-11 items-center text-sm underline";

function subscribeProvider(onChange: () => void) {
  window.addEventListener("ethereum#initialized", onChange);
  return () => window.removeEventListener("ethereum#initialized", onChange);
}

export default function PayView() {
  const params = useSearchParams();
  const parsed = useMemo(() => parsePayLink(params), [params]);

  if (!parsed.ok) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Kudi</h1>
        <p role="alert" className="mt-6 text-lg">
          This invoice link is broken. Ask for a new one.
        </p>
      </main>
    );
  }
  return <PayInvoice link={parsed.link} />;
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

  const amountText = decimals === null ? null : `${formatAmount(link.amt, decimals)} AUSD`;

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
        setPhase({
          kind: "failed",
          reason: isUserRejection(error)
            ? "connect_rejected"
            : isRequestAlreadyPending(error)
              ? "request_pending"
              : "connect_failed",
        });
      }
    });
  }

  function switchOnly() {
    void runExclusive(async () => {
      try {
        await switchNetwork();
      } catch (error) {
        setPhase({
          kind: "failed",
          reason: isUserRejection(error)
            ? "connect_rejected"
            : isRequestAlreadyPending(error)
              ? "request_pending"
              : "connect_failed",
        });
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

  let button: { label: string; disabled: boolean; kind: ButtonKind } | null = null;
  if (phase.kind === "paid" || phase.kind === "unconfirmed" || check.action === "no_wallet") {
    button = null;
  } else if (phase.kind === "connecting") {
    button = { label: "Connecting...", disabled: true, kind: "connect" };
  } else if (phase.kind === "switching") {
    button = { label: "Switching network...", disabled: true, kind: "switch" };
  } else if (sending) {
    button = { label: "Sending...", disabled: true, kind: "pay" };
  } else if (check.action === "not_connected") {
    button = {
      label: amountText ? `Connect wallet to pay ${amountText}` : "Connect wallet to pay",
      disabled: false,
      kind: "connect",
    };
  } else if (check.action === "wrong_chain") {
    button = { label: `Switch to ${config.chain.name}`, disabled: false, kind: "switch" };
  } else if (check.action === "checking") {
    button = { label: "Checking balances...", disabled: true, kind: "pay" };
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

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Kudi</h1>
      <p className="mt-6 text-zinc-700">Invoice from</p>
      <p className="text-xl font-semibold" data-testid="pay-from">
        {link.n}
      </p>
      {link.c !== "" && (
        <p className="mt-1 text-zinc-700" data-testid="pay-client">
          For {link.c}
        </p>
      )}

      <p className="mt-6 text-sm text-zinc-700">Amount</p>
      <p className="font-mono text-3xl" data-testid="pay-amount">
        {amountText ?? "Loading..."}
      </p>

      {link.m !== "" && (
        <>
          <p className="mt-6 text-sm text-zinc-700">Note</p>
          <p className="break-words" data-testid="pay-memo">
            {link.m}
          </p>
        </>
      )}

      <p className="mt-6 text-sm text-zinc-700">Receiving address</p>
      <p className="font-mono" title={link.to} data-testid="pay-to">
        {shortAddress(link.to)}
      </p>

      <section className="mt-8" aria-live="polite">
        {phase.kind === "paid" ? (
          <div className="rounded-lg border border-green-800 p-4" data-testid="pay-paid">
            <p className="text-2xl font-semibold">Paid</p>
            <p className="mt-1">
              {amountText} sent to {link.n}.
            </p>
            <a
              className={linkClass}
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
              <p role="alert" data-testid="pay-no-wallet">
                Open this link in a browser with a crypto wallet, like MetaMask.
              </p>
            )}

            {account !== null && check.action !== "no_wallet" && (
              <p className="mb-3 text-sm text-zinc-700">
                Connected as {shortAddress(account)}
                {balances.ausd !== null && decimals !== null
                  ? `. Your balance: ${formatAmount(balances.ausd, decimals)} AUSD.`
                  : "."}
              </p>
            )}

            {activeButton && (
              <button
                type="button"
                className={buttonClass}
                disabled={activeButton.disabled}
                onClick={() => onButtonClick(activeButton.kind)}
                data-testid="pay-button"
              >
                {activeButton.label}
              </button>
            )}

            {check.lowMon && check.action !== "no_wallet" && (
              <p className="mt-3 text-sm">
                You need a little testnet MON to send a payment.{" "}
                <a className="underline" href={config.monFaucetUrl} target="_blank" rel="noreferrer">
                  Get testnet MON
                </a>
              </p>
            )}

            {balances.failed && (
              <p role="status" className="mt-3 text-sm text-amber-900">
                Network is busy, retrying...
              </p>
            )}

            {phase.kind === "failed" && (
              <div role="alert" className="mt-3 text-sm text-red-800">
                <p>{FAILURE_MESSAGE[phase.reason]}</p>
                {phase.hash !== undefined && (
                  <a
                    className={linkClass}
                    href={explorerTxUrl(phase.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction
                  </a>
                )}
              </div>
            )}

            {phase.kind === "unconfirmed" && (
              <div role="alert" className="text-sm">
                <p>
                  Your payment was sent but is not confirmed yet. Do not pay again. Check the
                  transaction, or tap Check again.
                </p>
                <a
                  className={linkClass}
                  href={explorerTxUrl(phase.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
                <button
                  type="button"
                  className={`${buttonClass} mt-2`}
                  onClick={() => checkAgain(phase.hash)}
                >
                  Check again
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="mt-8 text-xs text-zinc-600" data-testid="pay-details">
        Invoice {link.inv}, created at block {link.b}
      </p>
    </main>
  );
}
