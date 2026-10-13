# Kudi

Passkey-based freelancer invoicing: one passkey derives a receiving address per client; clients pay AUSD on Monad testnet. PRD.md is the single source of truth.

## Current phase
Phases 0 and 1 done (passkey account, KUDI-01 to 04). Next: Phase 2, clients (KUDI-05, 06).

## Stack
Next.js App Router, TypeScript, Tailwind, viem, `@category-labs/mera`, `@scure/bip32`, `@scure/bip39`, vitest. Later: wagmi (pay page only).

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
