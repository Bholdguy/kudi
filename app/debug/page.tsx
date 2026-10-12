"use client";

import { useEffect, useState } from "react";
import { readDecimals, readSymbol } from "@/lib/ausd";
import { config, explorerAddressUrl } from "@/lib/config";

type TokenInfo = { symbol: string; decimals: number };
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; token: TokenInfo };

export default function DebugPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([readSymbol(), readDecimals()])
      .then(([symbol, decimals]) => {
        if (!cancelled) setState({ status: "ready", token: { symbol, decimals } });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Chain check</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {config.chain.name} (chain ID {config.chain.id})
      </p>

      <dl className="mt-6 space-y-3">
        <div>
          <dt className="text-sm text-zinc-600">Token contract</dt>
          <dd className="break-all font-mono text-sm">
            <a
              className="underline"
              href={explorerAddressUrl(config.ausdAddress)}
              target="_blank"
              rel="noreferrer"
            >
              {config.ausdAddress}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600">RPC endpoints in use</dt>
          <dd className="font-mono text-sm">{config.rpcUrls.length}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600">symbol()</dt>
          <dd className="font-mono text-lg" data-testid="symbol">
            {state.status === "loading" && "Loading..."}
            {state.status === "error" && "Unavailable"}
            {state.status === "ready" && state.token.symbol}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600">decimals()</dt>
          <dd className="font-mono text-lg" data-testid="decimals">
            {state.status === "loading" && "Loading..."}
            {state.status === "error" && "Unavailable"}
            {state.status === "ready" && state.token.decimals}
          </dd>
        </div>
      </dl>

      {state.status === "error" && (
        <div className="mt-6" role="alert">
          <p className="text-sm">Network is busy, could not read the token. Try again.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 min-h-11 rounded bg-black px-4 text-white"
          >
            Retry
          </button>
        </div>
      )}
    </main>
  );
}
