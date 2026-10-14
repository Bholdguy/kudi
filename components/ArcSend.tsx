"use client";

import { useState } from "react";
import type { Address, Hash } from "viem";
import { Button, Field, Spinner, buttonClass, inputClass } from "@/components/ui";
import { formatAmount } from "@/lib/amount";
import { arcFees } from "@/lib/arcPay";
import { estimateArcTransferGas, readArcMaxFee } from "@/lib/arcChain";
import { ArcSendError, sendArcUsdc, type SendCredential } from "@/lib/arcSend";
import { explorerTxUrl } from "@/lib/config";
import { NETWORKS } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { classifyPasskeyError, passkeyErrorMessage } from "@/lib/passkey";
import { classifySendError, maxSendable, sendAmountText, validateSend } from "@/lib/send";
import { waitForArcReceipt } from "@/lib/wallet";

export type SendRow = {
  index: number;
  name: string;
  address: Address;
  /** Native USDC balance in wei, 18 decimals. Null until read. */
  balance: bigint | null;
};

/** A checked send, ready for the freelancer to confirm. */
type Review = {
  from: SendRow;
  to: Address;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  fee: bigint;
};

type Step =
  | { kind: "closed" }
  | { kind: "form" }
  | { kind: "checking" }
  | { kind: "review"; review: Review }
  | { kind: "passkey"; review: Review }
  | { kind: "confirming"; review: Review; hash: Hash }
  | { kind: "done"; hash: Hash }
  | { kind: "unconfirmed"; hash: Hash }
  | { kind: "failed"; message: string; hash?: Hash };

const USDC = NETWORKS.arc.token.symbol;
const linkClass = "inline-flex min-h-11 items-center text-base font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";
const DECIMAL_TEXT = /^\d*\.?\d*$/;
const INSUFFICIENT = `Not enough ${USDC} on Arc to cover this transfer and its fee. Nothing was sent.`;

/** Sends native USDC out of one of the freelancer's Arc receiving addresses. Shown only when one has a balance. */
export default function ArcSend({ credential, rows }: { credential: SendCredential; rows: readonly SendRow[] }) {
  const senders = rows.filter((row) => row.balance !== null && row.balance > 0n);
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [fromIndex, setFromIndex] = useState<number | null>(null);
  const [to, setTo] = useState("");
  const [toError, setToError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  if (senders.length === 0) return null;

  const from = senders.find((row) => row.index === fromIndex) ?? senders[0];
  const balance = from.balance ?? 0n;

  function reset() {
    setStep({ kind: "closed" });
    setTo("");
    setToError(null);
    setAmount("");
    setAmountError(null);
  }

  function open() {
    setFromIndex(senders[0].index);
    setStep({ kind: "form" });
  }

  async function fillMax() {
    setAmountError(null);
    setStep({ kind: "checking" });
    try {
      const gas = await estimateArcTransferGas({ from: from.address, to: from.address, value: 0n });
      const { maxFeePerGas } = arcFees(await readArcMaxFee());
      const max = maxSendable(balance, gas, maxFeePerGas);
      setAmount(max > 0n ? sendAmountText(max) : "");
      if (max === 0n) setAmountError("This address can't cover the network fee.");
    } catch {
      setAmountError("Network is busy. Try Max again.");
    } finally {
      setStep({ kind: "form" });
    }
  }

  // Checks the typed fields first (no network), then the gas and fee, then the balance.
  async function review() {
    setToError(null);
    setAmountError(null);
    const fields = validateSend({ from: from.address, to, amountText: amount, balance, gas: 0n, maxFeePerGas: 0n });
    if (!fields.ok) {
      if (fields.field === "to") setToError(fields.message);
      else setAmountError(fields.message);
      return;
    }

    setStep({ kind: "checking" });
    try {
      const gas = await estimateArcTransferGas({ from: from.address, to: fields.to, value: fields.value });
      const { maxFeePerGas } = arcFees(await readArcMaxFee());
      const checked = validateSend({ from: from.address, to, amountText: amount, balance, gas, maxFeePerGas });
      if (!checked.ok) {
        setStep({ kind: "form" });
        if (checked.field === "to") setToError(checked.message);
        else setAmountError(checked.message);
        return;
      }
      setStep({
        kind: "review",
        review: { from, to: checked.to, value: checked.value, gas, maxFeePerGas, fee: checked.fee },
      });
    } catch (error) {
      const kind = classifySendError(error);
      setStep({
        kind: "failed",
        message:
          kind === "insufficient"
            ? INSUFFICIENT
            : kind === "refused"
              ? "The network refused this transfer. The recipient may be blocked. Nothing was sent."
              : "Network is busy. Nothing was sent. Try again.",
      });
    }
  }

  // Called straight from the Confirm tap: the passkey prompt must not wait behind any other await.
  function confirm(review: Review) {
    if (review.from.balance === null || review.from.balance < review.value + review.fee) {
      setStep({ kind: "failed", message: INSUFFICIENT });
      return;
    }
    setStep({ kind: "passkey", review });
    const { maxPriorityFeePerGas } = arcFees(null);
    const signed = sendArcUsdc({
      credential,
      index: review.from.index,
      from: review.from.address,
      to: review.to,
      value: review.value,
      gas: review.gas,
      maxFeePerGas: review.maxFeePerGas,
      maxPriorityFeePerGas,
    });
    void signed
      .then(async (hash) => {
        setStep({ kind: "confirming", review, hash });
        try {
          const result = await waitForArcReceipt(hash);
          setStep(
            result === "success"
              ? { kind: "done", hash }
              : {
                  kind: "failed",
                  hash,
                  message: "The transfer was rejected on-chain, possibly because an address is blocked. Gas may have been charged.",
                },
          );
        } catch {
          setStep({ kind: "unconfirmed", hash });
        }
      })
      .catch((error: unknown) => {
        setStep({ kind: "failed", message: sendFailureMessage(error) });
      });
  }

  if (step.kind === "closed") {
    return (
      <div className="mt-6">
        <Button variant="secondary" onClick={open}>
          Send {USDC} from Arc
        </Button>
      </div>
    );
  }

  if (step.kind === "done") {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-palm/40 bg-palm-soft p-4" data-testid="send-done">
        <p className="font-semibold text-palm">Sent.</p>
        <a className={linkClass} href={explorerTxUrl(step.hash, "arc")} target="_blank" rel="noreferrer">
          View transaction
        </a>
        <div className="mt-2">
          <Button variant="secondary" onClick={reset}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "unconfirmed") {
    return (
      <div role="alert" className="mt-6 rounded-2xl bg-amber-soft p-4 text-amber-ink">
        <p className="font-semibold">Sent, but not confirmed yet. Don&apos;t send it again. Check the transaction.</p>
        <a className={linkClass} href={explorerTxUrl(step.hash, "arc")} target="_blank" rel="noreferrer">
          View transaction
        </a>
      </div>
    );
  }

  if (step.kind === "review" || step.kind === "passkey" || step.kind === "confirming") {
    const { review } = step;
    return (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5" data-testid="send-review">
        <h3 className="font-display text-2xl font-bold">Confirm send</h3>
        <dl className="mt-4 divide-y divide-line">
          <div className="py-2">
            <dt className="text-sm text-muted">From</dt>
            <dd className="font-semibold">{`${review.from.name} · ${shortAddress(review.from.address)}`}</dd>
          </div>
          <div className="py-2">
            <dt className="text-sm text-muted">To</dt>
            <dd className="break-all font-semibold">{review.to}</dd>
          </div>
          <div className="py-2">
            <dt className="text-sm text-muted">Amount</dt>
            <dd className="font-semibold tabular-nums">{`${sendAmountText(review.value)} ${USDC}`}</dd>
          </div>
          <div className="py-2">
            <dt className="text-sm text-muted">Estimated fee</dt>
            <dd className="tabular-nums">{`${sendAmountText(review.fee)} ${USDC}`}</dd>
          </div>
        </dl>
        {step.kind === "review" && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => confirm(review)}>Confirm and send</Button>
            <Button variant="secondary" onClick={() => setStep({ kind: "form" })}>
              Back
            </Button>
          </div>
        )}
        {step.kind === "passkey" && (
          <p role="status" className="mt-4 flex items-center gap-2 text-muted">
            <Spinner /> Confirm with your passkey to sign.
          </p>
        )}
        {step.kind === "confirming" && (
          <p role="status" className="mt-4 text-muted">
            Sent. Waiting for confirmation. Keep this page open.
          </p>
        )}
      </div>
    );
  }

  if (step.kind === "failed") {
    return (
      <div role="alert" className="mt-6 rounded-2xl bg-clay-soft p-4 text-clay" data-testid="send-failed">
        <p className="font-semibold">{step.message}</p>
        {step.hash !== undefined && (
          <a className={linkClass} href={explorerTxUrl(step.hash, "arc")} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setStep({ kind: "form" })}>
            Try again
          </Button>
          <Button variant="quiet" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // The form, or "checking" while the chain is read; the form stays on screen then.
  const checking = step.kind === "checking";
  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void review();
      }}
      data-testid="send-form"
    >
      <h3 className="font-display text-2xl font-bold">Send {USDC} from Arc</h3>

      <Field id="send-from" label="From">
        {(fieldProps) => (
          <select
            {...fieldProps}
            value={from.index}
            onChange={(event) => setFromIndex(Number(event.target.value))}
            className={`${inputClass} border-line`}
          >
            {senders.map((row) => (
              <option key={row.index} value={row.index}>
                {`${row.name} · ${shortAddress(row.address)} · ${formatAmount(row.balance ?? 0n, 18)} ${USDC}`}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="send-to" label="Send to" hint="Paste the recipient's Arc address (0x…)." error={toError}>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={to}
            onChange={(event) => {
              setTo(event.target.value.trim());
              setToError(null);
            }}
            className={`${inputClass} ${toError ? "border-clay" : "border-line"}`}
          />
        )}
      </Field>

      <Field id="send-amount" label={`Amount in ${USDC}`} hint="Up to 6 decimals." error={amountError}>
        {(fieldProps) => (
          <div className="flex gap-2">
            <input
              {...fieldProps}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => {
                if (!DECIMAL_TEXT.test(event.target.value)) return;
                setAmount(event.target.value);
                setAmountError(null);
              }}
              className={`${inputClass} flex-1 ${amountError ? "border-clay" : "border-line"}`}
            />
            <button type="button" className={buttonClass("secondary")} onClick={fillMax} disabled={checking}>
              Max
            </button>
          </div>
        )}
      </Field>

      <p className="text-sm text-muted">
        Balance: {formatAmount(balance, 18)} {USDC}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={checking}>
          {checking && <Spinner />}
          {checking ? "Checking..." : "Review"}
        </Button>
        <Button variant="quiet" onClick={reset} disabled={checking}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function sendFailureMessage(error: unknown): string {
  if (error instanceof ArcSendError) {
    if (error.reason === "passkey") {
      const kind = classifyPasskeyError(error.cause);
      if (kind === "cancelled") return "Passkey cancelled. Nothing was sent.";
      return `${passkeyErrorMessage(kind, "signIn")} Nothing was sent.`;
    }
    if (error.reason === "mismatch") return "This receiving address could not be unlocked. Nothing was sent.";
  }
  const kind = classifySendError(error);
  if (kind === "refused") return "The network refused this transfer. The recipient may be blocked. Nothing was sent.";
  if (kind === "insufficient") return INSUFFICIENT;
  return "Network is busy. Nothing was sent. Try again.";
}
