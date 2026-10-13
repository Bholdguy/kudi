"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

const primaryButton =
  "min-h-11 w-full rounded-lg bg-black px-4 text-base font-medium text-white disabled:opacity-60";
const secondaryButton =
  "min-h-11 w-full rounded-lg border border-zinc-400 px-4 text-base font-medium text-zinc-900 disabled:opacity-60";
const linkButton = "min-h-11 px-2 text-sm text-zinc-700 underline disabled:opacity-60";

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
    try {
      const account =
        action === "signUp" ? await createAccount() : await signInWithPasskey(stored);
      saveState(mergeAccount(account, loadState()));
      setSignedIn(true);
      router.push("/app");
    } catch (e) {
      setError(passkeyErrorMessage(classifyPasskeyError(e), action));
      setBusy(null);
    }
  }

  const hasAccount = stored !== null;
  const disabled = busy !== null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <h1 className="text-4xl font-semibold tracking-tight">Kudi</h1>
      <p className="mt-3 text-lg text-zinc-700">
        Get paid from anywhere, in real dollars, with your face.
      </p>

      {ready && (
        <div className="mt-10 flex flex-col gap-3">
          {hasAccount ? (
            <>
              <button
                type="button"
                className={primaryButton}
                disabled={disabled}
                onClick={() => run("signIn")}
              >
                {busy === "signIn" ? "Signing in..." : "Sign in"}
              </button>
              <div className="flex flex-col items-start">
                <button
                  type="button"
                  className={linkButton}
                  disabled={disabled}
                  onClick={() => run("signUp")}
                >
                  {busy === "signUp" ? "Creating account..." : "Create a new account"}
                </button>
                <p className="px-2 text-xs text-zinc-600">
                  A new account replaces the one saved on this device.
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className={primaryButton}
                disabled={disabled}
                onClick={() => run("signUp")}
              >
                {busy === "signUp" ? "Creating account..." : "Create account"}
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={disabled}
                onClick={() => run("signIn")}
              >
                {busy === "signIn" ? "Signing in..." : "Sign in"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
