"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/BrandMark";
import { AlertIcon, Button, CheckIcon, Spinner } from "@/components/ui";
import {
  classifyPasskeyError,
  createAccount,
  passkeyErrorMessage,
  signInWithPasskey,
  type PasskeyAccount,
  type PasskeyAction,
} from "@/lib/passkey";
import { loadState, saveState, setSignedIn, type StoredState } from "@/lib/store";
import { useHydrated, useSignedIn, useStoredState } from "@/lib/useStore";

function mergeAccount(account: PasskeyAccount, existing: StoredState | null): StoredState {
  const sameAccount = existing !== null && existing.homeAddress === account.homeAddress;
  const transports =
    account.transports.length > 0 || !sameAccount ? account.transports : existing.transports;
  return {
    credentialId: account.credentialId,
    transports,
    homeAddress: account.homeAddress,
    accountXpub: account.accountXpub,
    displayName: sameAccount ? existing.displayName : "",
    clients: sameAccount ? existing.clients : [],
    invoices: sameAccount ? existing.invoices : [],
  };
}

const STEPS = [
  {
    title: "Create your account",
    body: "Look at your phone. Face ID or Touch ID makes it. There is no password to remember.",
  },
  {
    title: "Send a payment link",
    body: "Add a client, enter an amount and share the link. Each client gets their own address.",
  },
  {
    title: "Watch it land",
    body: "Your client pays in dollars. Your screen says Paid the moment it arrives.",
  },
];

const OUTCOMES = [
  "You receive the full invoice amount, in dollars.",
  "Your face is the key. Nothing to write down or lose.",
  "You always know which client paid, without asking.",
];

const ANSWERS = [
  {
    question: "Does my client need crypto?",
    answer:
      "Yes. They pay with a crypto wallet such as MetaMask, in USDC on Arc or AUSD on Monad testnet. You don't need either to get started.",
  },
  {
    question: "Which network is this?",
    answer:
      "Two. Arc mainnet for real USDC: payments settle in under a second, and fees are paid in USDC. Monad testnet with Agora's AUSD, if you want to try it free first.",
  },
];

/** A face-scan frame with a coin: the product's one gesture, drawn once. */
function FaceScanArt() {
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 sm:h-52 sm:w-52" role="img" aria-label="A face being scanned, with a gold coin">
      <rect x="18" y="18" width="164" height="164" rx="44" fill="#e8eaf7" />
      <g stroke="#232d7a" strokeWidth="9" strokeLinecap="round" fill="none">
        <path d="M44 74V62a18 18 0 0 1 18-18h12" />
        <path d="M156 74V62a18 18 0 0 0-18-18h-12" />
        <path d="M44 126v12a18 18 0 0 0 18 18h12" />
        <path d="M156 126v12a18 18 0 0 1-18 18h-12" />
      </g>
      <g fill="#232d7a">
        <rect x="78" y="82" width="9" height="20" rx="4.5" />
        <rect x="113" y="82" width="9" height="20" rx="4.5" />
      </g>
      <path d="M82 122c5 9 12 13 18 13s13-4 18-13" stroke="#232d7a" strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="160" cy="150" r="30" fill="#f4b22b" />
      <circle cx="160" cy="150" r="21" fill="none" stroke="#141a4a" strokeOpacity=".3" strokeWidth="3" />
      <path d="M152 150.5l6.2 6.2L170 143" stroke="#141a4a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Actions({
  hasAccount,
  welcomeName,
  busy,
  error,
  onRun,
  dark = false,
}: {
  hasAccount: boolean;
  welcomeName: string;
  busy: PasskeyAction | null;
  error: string | null;
  onRun: (action: PasskeyAction) => void;
  dark?: boolean;
}) {
  const disabled = busy !== null;
  const primary = dark ? "onDark" : "primary";
  const secondary = dark ? "onDark" : "secondary";

  const signInLabel = busy === "signIn" ? "Signing in..." : "Sign in";
  const createLabel = busy === "signUp" ? "Creating account..." : "Create account";

  return (
    <div className="flex flex-col gap-3">
      {hasAccount && welcomeName !== "" && (
        <p className={`text-lg font-semibold ${dark ? "text-white" : "text-ink"}`}>
          Welcome back, {welcomeName}
        </p>
      )}
      {hasAccount ? (
        <>
          <Button variant={primary} disabled={disabled} onClick={() => onRun("signIn")} className="w-full sm:w-auto sm:self-start">
            {busy === "signIn" && <Spinner />}
            {signInLabel}
          </Button>
          <div className="flex flex-col items-start">
            <Button
              variant="quiet"
              disabled={disabled}
              onClick={() => onRun("signUp")}
              className={dark ? "!text-white !decoration-white/60" : ""}
            >
              {busy === "signUp" ? "Creating account..." : "Create a new account"}
            </Button>
            <p className={`px-2 text-sm ${dark ? "text-white/80" : "text-muted"}`}>
              A new account replaces the one saved on this device.
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant={primary} disabled={disabled} onClick={() => onRun("signUp")} className="w-full sm:w-auto">
            {busy === "signUp" && <Spinner />}
            {createLabel}
          </Button>
          <Button variant={secondary} disabled={disabled} onClick={() => onRun("signIn")} className="w-full sm:w-auto">
            {busy === "signIn" && <Spinner />}
            {signInLabel}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className={`flex items-start gap-1.5 text-base font-medium ${dark ? "text-white" : "text-clay"}`}>
          <AlertIcon className="mt-1 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const stored = useStoredState();
  const signedIn = useSignedIn();
  const ready = useHydrated();
  const [busy, setBusy] = useState<PasskeyAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stored && signedIn) router.replace("/app");
  }, [stored, signedIn, router]);

  async function run(action: PasskeyAction) {
    setBusy(action);
    setError(null);
    // The passkey code is imported up front on purpose: iOS Safari only shows the passkey prompt
    // straight after a tap, so nothing may be awaited between the tap and the prompt.
    try {
      const account =
        action === "signUp" ? await createAccount() : await signInWithPasskey(stored);
      const merged = mergeAccount(account, loadState());
      // E16: signing in with no saved clients (cleared storage, new device) rebuilds them from the chain.
      if (action === "signIn" && merged.clients.length === 0) {
        const { recoverClients } = await import("@/lib/recovery");
        merged.clients = await recoverClients(merged.accountXpub, Math.floor(Date.now() / 1000));
      }
      saveState(merged);
      setSignedIn(true);
      router.push("/app");
    } catch (e) {
      setError(passkeyErrorMessage(classifyPasskeyError(e), action));
      setBusy(null);
    }
  }

  const hasAccount = stored !== null;
  const actionProps = {
    hasAccount,
    welcomeName: stored?.displayName ?? "",
    busy,
    error,
    onRun: run,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-5 pt-6">
        <Logo />
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="adire-light pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid w-full max-w-5xl gap-8 px-5 pb-14 pt-10 md:grid-cols-[1.3fr_1fr] md:items-center md:pt-16">
            <div className="stagger">
              <p className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
                Now live on Arc mainnet · real USDC
              </p>
              <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl">
                Get paid from anywhere, in real dollars, with your face.
              </h1>
              <p className="mt-5 max-w-[36ch] text-lg text-muted">
                Send your client a link. They pay in dollars. You see it the moment it lands, with no
                password and no bank in between.
              </p>
              <div className="mt-8 min-h-[7.5rem]">{ready && <Actions {...actionProps} />}</div>
            </div>
            <div className="flex justify-start md:justify-center">
              <FaceScanArt />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-10">
          <h2 className="font-display text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 md:flex-col md:gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mt-1 max-w-[38ch] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-6">
          <ul className="grid gap-3 md:grid-cols-3">
            {OUTCOMES.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-palm-soft text-palm">
                  <CheckIcon />
                </span>
                <span className="text-lg">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-10">
          <dl className="grid gap-6 md:grid-cols-2">
            {ANSWERS.map((item) => (
              <div key={item.question}>
                <dt className="font-display text-xl font-semibold">{item.question}</dt>
                <dd className="mt-1 max-w-[46ch] text-muted">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="adire-dark on-dark bg-brand-deep text-white">
          <div className="mx-auto w-full max-w-5xl px-5 py-12">
            <h2 className="font-display text-3xl font-bold tracking-tight">Ready to get paid?</h2>
            <p className="mt-2 max-w-[40ch] text-white/85">Your first payment link is a minute away.</p>
            <div className="mt-6 min-h-[5rem]">{ready && <Actions {...actionProps} dark />}</div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-6 text-sm text-muted">
        Kudi runs on Arc mainnet with real USDC, and on Monad testnet with Agora&apos;s AUSD.
      </footer>
    </div>
  );
}
