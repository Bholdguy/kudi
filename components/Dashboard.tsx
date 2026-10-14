"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import AccountSection from "@/components/AccountSection";
import ActivitySection from "@/components/ActivitySection";
import { Logo } from "@/components/BrandMark";
import ClientsSection from "@/components/ClientsSection";
import InvoicesSection from "@/components/InvoicesSection";
import Summary, { type NetworkFigures } from "@/components/Summary";
import { Button, Skeleton } from "@/components/ui";
import { receivedFromPaidInvoices, sumKnown } from "@/lib/assets";
import { NETWORKS, type NetworkKey } from "@/lib/chains";
import { clientAddress } from "@/lib/clients";
import { setSignedIn, type StoredState } from "@/lib/store";
import { useArcBalances } from "@/lib/useArcBalances";
import { useBalances } from "@/lib/useBalances";
import { useTokenDecimals } from "@/lib/useTokenDecimals";
import { useHydrated, useSignedIn, useStoredState } from "@/lib/useStore";

function SignedInView({ state, onSignOut }: { state: StoredState; onSignOut: () => void }) {
  const rows = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        address: clientAddress(state.accountXpub, client),
      })),
    [state.clients, state.accountXpub],
  );
  const addresses = rows.map((row) => row.address);
  const balanceState = useBalances(addresses);
  const arcState = useArcBalances(addresses);
  const arcDecimals = useTokenDecimals("arc");
  const { balances, decimals } = balanceState;

  // Live balances over the receiving addresses (the client addresses), per network.
  const hasRows = rows.length > 0;
  const figures: Record<NetworkKey, NetworkFigures> = {
    monad: {
      received: receivedFromPaidInvoices(state.invoices, "monad"),
      receivedDecimals: decimals,
      balance: hasRows ? sumKnown(addresses.map((address) => balances[address])) : null,
      balanceDecimals: decimals,
      balanceFailed: balanceState.failed,
    },
    arc: {
      received: receivedFromPaidInvoices(state.invoices, "arc"),
      receivedDecimals: arcDecimals,
      balance: hasRows ? sumKnown(addresses.map((address) => arcState.balances[address])) : null,
      balanceDecimals: NETWORKS.arc.chain.nativeCurrency.decimals,
      balanceFailed: arcState.failed,
    },
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-5">
        <Logo size={30} />
        <Button variant="quiet" onClick={onSignOut}>
          Sign out
        </Button>
      </header>
      <main className="stagger mx-auto w-full max-w-2xl px-5 pb-20">
        <Summary state={state} figures={figures} />
        <InvoicesSection state={state} />
        <ClientsSection state={state} rows={rows} balanceState={balanceState} />
        {rows.length > 0 && <ActivitySection state={state} />}
        {state.displayName !== "" && <AccountSection state={state} />}
      </main>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const state = useStoredState();
  const signedIn = useSignedIn();
  const hydrated = useHydrated();

  const allowed = state !== null && signedIn;

  useEffect(() => {
    if (hydrated && !allowed) router.replace("/");
  }, [hydrated, allowed, router]);

  if (!state || !signedIn) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-10" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-6 h-12 w-64" />
        <Skeleton className="mt-4 h-24 w-full" />
        <span className="sr-only">Loading your account</span>
      </main>
    );
  }

  function signOut() {
    setSignedIn(false);
    router.replace("/");
  }

  return <SignedInView state={state} onSignOut={signOut} />;
}
