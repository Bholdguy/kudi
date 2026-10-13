"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ClientsSection from "@/components/ClientsSection";
import CopyButton from "@/components/CopyButton";
import { config } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { saveState, setSignedIn } from "@/lib/store";
import { useHydrated, useSignedIn, useStoredState } from "@/lib/useStore";

const primaryButton =
  "min-h-11 rounded-lg bg-black px-4 text-base font-medium text-white disabled:opacity-60";
const secondaryButton =
  "min-h-11 rounded-lg border border-zinc-400 px-4 text-base font-medium text-zinc-900";
const linkButton = "min-h-11 px-2 text-sm text-zinc-700 underline";

export default function Dashboard() {
  const router = useRouter();
  const state = useStoredState();
  const signedIn = useSignedIn();
  const hydrated = useHydrated();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const allowed = state !== null && signedIn;

  useEffect(() => {
    if (hydrated && !allowed) router.replace("/");
  }, [hydrated, allowed, router]);

  if (!state || !signedIn) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <p className="text-zinc-700">Loading...</p>
      </main>
    );
  }

  const trimmedName = nameInput.trim();
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= config.displayNameMaxLength;
  const showNameForm = state.displayName === "" || editingName;

  function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!state || !nameValid) return;
    const next = { ...state, displayName: trimmedName };
    saveState(next);
    setEditingName(false);
  }

  function signOut() {
    setSignedIn(false);
    router.replace("/");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kudi</h1>
        <button type="button" className={linkButton} onClick={signOut}>
          Sign out
        </button>
      </header>

      {showNameForm ? (
        <form onSubmit={saveName} className="mt-8 flex flex-col gap-3">
          <label htmlFor="display-name" className="text-base font-medium">
            Your name on invoices
          </label>
          <input
            id="display-name"
            type="text"
            value={nameInput}
            maxLength={config.displayNameMaxLength}
            onChange={(e) => setNameInput(e.target.value)}
            autoComplete="name"
            className="min-h-11 rounded-lg border border-zinc-400 px-3 text-base"
          />
          <p className="text-xs text-zinc-600">
            {trimmedName.length} of {config.displayNameMaxLength} characters
          </p>
          <div className="flex gap-3">
            <button type="submit" className={primaryButton} disabled={!nameValid}>
              Save name
            </button>
            {state.displayName !== "" && (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setNameInput(state.displayName);
                  setEditingName(false);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <section className="mt-8 flex items-center justify-between gap-3">
          <p className="text-xl">
            Hi, <span className="font-semibold">{state.displayName}</span>
          </p>
          <button type="button" className={linkButton} onClick={() => {
              setNameInput(state.displayName);
              setEditingName(true);
            }}>
            Change name
          </button>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-zinc-300 p-4">
        <h2 className="text-sm text-zinc-700">Your account address</h2>
        <p className="mt-1 font-mono text-lg" data-testid="home-address" title={state.homeAddress}>
          {shortAddress(state.homeAddress)}
        </p>
        <CopyButton
          text={state.homeAddress}
          label="Copy address"
          className={`${secondaryButton} mt-3`}
        />
      </section>

      <ClientsSection state={state} />
    </main>
  );
}
