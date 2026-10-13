# Kudi

Passkey-based freelancer invoicing: one passkey derives a receiving address per client; clients pay AUSD on Monad testnet. PRD.md is the single source of truth.

## Current phase
Phases 0 to 4 done (passkey account; clients; invoices; pay page). Next: Phase 5, live receipt (KUDI-14, 15). Before Phase 7: create the public GitHub repo (bholdguy) and push. Every phase ends with a Vercel production deploy (`npx vercel deploy --prod --yes`).

## Stack
Next.js App Router, TypeScript, Tailwind, viem, `@category-labs/mera`, `@scure/bip32`, `@scure/bip39`, vitest. No wagmi (see decisions log).

## Config rules
- Addresses, chain ID, RPC URLs, explorer URL live only in `lib/config.ts` (env overrides: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RPC_URL_FALLBACK`).
- Token decimals are read from the contract, never hardcoded. All token math is bigint.
- No mock data, no `console.log`, no TODOs. Never commit `.env` or keys.
- Freelancer-side copy: no "wallet", "gas", "seed", "private key", "mnemonic" (NFR-13).

## Non-goals (PRD)
- No withdrawals, sweeps or sends from the freelancer.
- No fiat on/off-ramp.
- No backend, database or server accounts.
- No credit, subscriptions or recurring billing.
- No mainnet.
- No FX rates or live price API.
- No email, SMS or push notifications.
- No multi-token support (AUSD only).
- No native mobile app.
- No AI features.
- No smart contracts written by us.

## Workflow
One phase at a time. Before coding a phase: interpretation, open questions, assumptions, ordered plan, then wait for approval. Commit per phase with requirement IDs. Rename this file to AGENTS.md at submission.

## Decisions log
- 2026-10-12 Phase 0: fallback RPC comes only from `NEXT_PUBLIC_RPC_URL_FALLBACK`; if empty or equal to the primary, run on the primary alone.
- Explorer is `https://testnet.monadscan.com` per PRD (viem's `monadTestnet` lists a different explorer; config overrides it).
- AUSD testnet `decimals()` = 6, `symbol()` = AUSD (read live on /debug).
- Dropped `next/font/google`: it needs network at dev time and adds an external host. System font stack instead.
- Dropped the template's dark-mode CSS (KUDI-20 is P2).
- Added `lib/client.ts` (shared viem public client) beyond the PRD module list.
- Repo root has a Next-generated `AGENTS.md` (Next 16 docs pointer). At submission, merge it with this file when renaming.
- Scaffolded in a lowercase scratch folder because npm rejects the capitalised folder name `Kudi`; package name is `kudi`.
- 2026-10-13 Phase 1: derivation follows Mera's demo: PRF output, BIP-39 entropy, BIP-44 `m/44'/60'/0'/0/{i}`. Mera has no BIP-44 helper; `lib/passkey.ts` owns it. Mera has no "cancelled" error code, so `PASSKEY_OPERATION_FAILED` maps to the PRD's "cancelled" copy.
- `accountXpub` (xpub at `m/44'/60'/0'/0`) is stored in `kudi:v1` on purpose. It is public data and lets Phase 2 derive client addresses with no passkey prompt. Caution for KUDI-17: an xpub plus any one child private key reveals the account's private keys, so KUDI-17 must not sign with a key derived under this xpub without a decision first.
- Private material (PRF output, seed, HD nodes) is zeroed after use. The transient mnemonic string cannot be zeroed in JS.
- Signed-in state is a `sessionStorage` flag: closing the tab means signing in again. Account data stays in localStorage. In-memory fallback covers private windows (E16).
- Landing: if `kudi:v1` holds a credential, "Sign in" is primary and "Create a new account" is a small link.
- passkey `rpId` comes from `NEXT_PUBLIC_PASSKEY_RP_ID` (default `localhost`); it is inlined at build time, so set it before the production build.
- 2026-10-13 KUDI-17 (signed invoices) DROPPED by the owner. Reason: signing needs a client-address private key, and with `accountXpub` stored in the browser, one exposed child key reveals the whole account's keys. No invoice signing anywhere; the `sig` link param is unused.
- 2026-10-13 Phase 2: client addresses come from `addressAt(accountXpub, index)` with no passkey prompt; the UI shows the derived address, never the stored copy. Indexes start at 1 (0 is home). Duplicate client names allowed. Total row sums client addresses only.
- Balances: one batched (multicall3) read every 5 s, paused while the tab is hidden; last values kept on failure. Multicall3 at viem's address has code on Monad testnet (checked via eth_getCode). Amounts display with 2 decimals, truncated (`lib/amount.ts`).
- tsconfig target raised to ES2020 (BigInt literals, NFR-08).
- AUSD faucet: proxy 0xd236...ee6C, implementation 0xba804DF5c476E8EaeF87BF8085F295300ccE2a49 (verified, AgoraFaucet). `requestFunds(address _receiver)` sends 10,000 AUSD to any receiver; receiver cap 100,000 AUSD; `maxDripFrequency` 60 s with a single global `lastDripTimestamp` (read as a shared cooldown, source not read). Relevant to KUDI-16.
- 2026-10-13 Phase 3: stored invoices carry an extra `createdAt` (unix seconds) beyond the PRD schema, for KUDI-15's elapsed time. Invoice id is `inv_` + 6 chars from a look-alike-free 32-symbol alphabet. Amounts typed as digits with at most 2 decimals, 0.01 to 1,000,000 (limits in `lib/config.ts`).
- Pay link = PRD format without `sig`, built by `lib/invoice.ts`; `parsePayLink` treats any invalid field as a broken link (E14). `/pay` exists now as a read-only decoder (no wallet or pay button); Phase 4 builds on it.
- A new invoice records the live block number; if the read fails, no invoice is created. Invoice creation needs a display name and at least one client.
- 2026-10-13 Phase 4: DEVIATION FROM THE PRD STACK (owner decision, for time and risk): no wagmi and no react-query. The pay page uses viem only: `window.ethereum` with `createWalletClient(custom(provider))`, `requestAddresses`, `switchChain`, and `addChain` when the wallet reports 4902. Code is in `lib/wallet.ts`.
- Wallet errors are matched by code (4001 rejected, 4902 unknown chain, -32002 request pending) by walking the `cause` chain and `data.originalError`, never by message text. A payment that was sent but not yet confirmed offers only "Check again" (no retry), so a payer cannot pay twice by mistake.
- Gas: viem's `estimateContractGas` with no padding (NFR-09). Read-only check: 72,930 gas for a 50 AUSD transfer, about 0.0074 MON at 102 gwei. The page was seen to send exactly that figure.
- Fallback RPC is now set: `NEXT_PUBLIC_RPC_URL_FALLBACK=https://rpc-testnet.monadinfra.com` (Monad Foundation, 20 rps per the Monad docs) on Vercel production and in `.env.example`. Official MON faucet: https://faucet.monad.xyz.
- The agent never sends or confirms a payment. Real payments are made by the owner from MetaMask. Wallet-less UI states were checked with a throwaway test provider that rejects every send; it is not part of the shipped code.
