# Kudi

Passkey-based freelancer invoicing: one passkey derives a receiving address per client; clients pay AUSD on Monad testnet. PRD.md is the single source of truth.

## Current phase
Phase 0 done (scaffold and chain). Next: Phase 1, passkey account (KUDI-01 to 04). Read the Mera source before starting it.

## Stack
Next.js App Router, TypeScript, Tailwind, viem. Later: `@category-labs/mera`, `@scure/bip32`, `@scure/bip39`, wagmi (pay page only).

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
