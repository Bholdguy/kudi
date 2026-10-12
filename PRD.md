# Kudi PRD

Oct 12, 2026 · @Bholdguyyy

## Summary

Kudi lets a freelancer get paid in real dollars from any client, anywhere, using only their face. The freelancer signs up with a passkey (Face ID or Touch ID). Kudi derives a separate receiving address for every client from that one passkey. The client opens a pay link, sends AUSD on Monad testnet, and the freelancer's screen flips to "Paid" with a real transaction hash in seconds.

**What this PRD locks:** one product, one user flow, one chain. Freelancer onboarding, per-client addresses, invoice links, payment, live receipt. Nothing else ships before the deadline.

**Built for:** Monad Metropolis, Consumer Products & Payments track. Targets the Agora cross-border payments bounty and both Mera bounties.

**Pitch line:** Get paid from anywhere, in real dollars, with your face.

## Problem and evidence

Freelancers outside major banking corridors lose money and days on every foreign payment, and crypto feels too risky to use instead. Two pains stack on top of each other.

**Pain 1: getting paid across borders is slow and expensive.** Freelancers report losing up to 4% in PayPal conversion fees plus instant-transfer fees ([r/Freelancers](https://www.reddit.com/r/Freelancers/comments/1hy1cyx/paypal_fees_are_bleeding_freelancers_dry_its_time/)). In some markets Payoneer costs around 5% all-in and Wise blocks new sign-ups ([r/PakStartups](https://www.reddit.com/r/PakStartups/comments/1t5i872/pakistani_freelancers_heres_the_honest_2026/)).

**Pain 2: the crypto alternative scares people off.** Seed phrases cause near-misses with life savings ([r/CryptoCurrency](https://www.reddit.com/r/CryptoCurrency/comments/1mbvulg/warning_to_trezor_users_if_you_lose_your/), 900+ score). Normal users fear storing a 24-word phrase at all.

**The gap Kudi fills:** stablecoin rails fix pain 1. Passkeys fix pain 2. No one has packaged both for a freelancer billing a foreign client.

Evidence source: Reddit research run on 2026-10-12. Quotes are paraphrased; links go to the original threads.

## Users and personas

Kudi has two users: the freelancer who gets paid, and the client who pays. The freelancer is the hero. The client just needs the payment to be easy.

| Persona | Who | What they want | What they fear |
| --- | --- | --- | --- |
| Ada, the freelancer (primary) | UI designer in Lagos, billing a Berlin startup monthly | Full invoice amount, fast, in dollars | Fees, frozen accounts, losing a seed phrase |
| Jonas, the client (secondary) | Ops lead at the startup, already holds a crypto wallet | Pay the invoice in under a minute | Sending to the wrong address, paying twice |

**Assumption:** the client already has an EVM wallet (MetaMask or similar). The freelancer has never used crypto. This split is deliberate. It puts the onboarding burden on Kudi, not on the person least likely to tolerate it.

## Goals and success metrics

Kudi succeeds if a judge can watch a non-crypto freelancer get paid in real AUSD, end to end, in under 90 seconds with zero seed phrases.

**User goals**

- Ada signs up with her face and never sees a seed phrase.
- Ada knows which client paid without asking.
- Jonas pays an invoice in one screen.

**Hackathon goals**

- Qualify for 4 prizes from one build: Consumer track, Agora cross-border, Mera UX, Mera One Passkey Many Keys.
- Beat the closest rival (Polaris) on two visible points: real testnet AUSD instead of a mock dollar, and a narrower, fully finished flow.

| Metric | Target | How it is checked |
| --- | --- | --- |
| Sign-up to first invoice link | Under 30 s | Stopwatch on the demo recording |
| Payment confirmed to "Paid" on freelancer screen | Under 3 s | Timestamp of tx block vs UI update |
| Seed phrases shown to the freelancer | 0 | Manual review of every screen |
| Real testnet AUSD transfers in README | At least 3, with explorer links | README table |
| External services in the payment path | Only the Monad RPC | Code review |
| End-to-end demo runs without a code change | 5 of 5 attempts | Rehearsal log |

**Counter-metric:** if any step needs narration to be understood, the flow is too complex. Cut the step.

## Non-goals

Everything below is out of scope for the hackathon build. The coding agent must not build any of it, even if it seems related or easy.

- **No withdrawals, sweeps or sends from the freelancer.** Kudi is receive-only. The freelancer never needs MON for gas.
- **No fiat on-ramp or off-ramp.** No bank cash-out, no card payments.
- **No backend, database or user accounts on a server.** State lives in the URL, the browser and the chain.
- **No credit, subscriptions, recurring billing or pay-in-4.** That is Polaris's territory.
- **No mainnet.** Testnet only. Mainnet is one config change later, not now.
- **No FX rates or local-currency conversion.** No live price API anywhere.
- **No email, SMS or push notifications.**
- **No multi-token support.** AUSD only.
- **No native mobile app.** Mobile web in Safari only.
- **No AI features.**
- **No smart contracts written by us.** Kudi only calls the existing AUSD token contract.

Stretch items are allowed only after every P0 requirement passes its acceptance check.

## Hackathon fit

Submissions close 13 Oct 2026; the exact hour sits behind the portal login and must be confirmed. Judging runs 14 to 27 Oct, winners on 3 Nov ([Metropolis](https://monad.xyz/developers/hackathons/metropolis)).

**Rules that shape the build**

- Submit a working product with a public profile: demo, short write-up, code link.
- Existing ideas are fine, but the submitted work must be built during the hackathon window. Kudi is a fresh codebase.
- Open source is optional, but judges must be able to verify what was built. The repo will be public.
- Solo builders are allowed.

| Prize | Amount | Why Kudi qualifies |
| --- | --- | --- |
| Consumer Products & Payments track | $10,000 (1 of 3 winners) | A payments app that never makes the freelancer think about blockchain |
| Agora: Best Cross-Border Payments App on Monad | $10,000 | A freelancer abroad gets paid by a foreign client in real AUSD |
| Monad Foundation: Mera, One Passkey Many Keys | $2,500 | One passkey derives a separate address per client |
| Monad Foundation: Best Mera-Powered UX | $2,500 | Face ID sign-up, no seed phrase, no extension |

**Rival to beat:** [Polaris](https://github.com/nickthelegend/polaris-monad) ships payment links, credit and subscriptions in AUSD with passkeys, but runs on a mock dollar on testnet. Kudi wins by using Agora's real testnet AUSD and by finishing a narrower flow completely.

## User journeys

The whole product is one loop: Ada creates a link, Jonas pays it, Ada's phone says Paid.

&#91;embedded content: user journey · 9 steps across freelancer, client and chain\]

Ada never pays gas, never sees a seed phrase and never signs a transaction. The only transaction in the product is Jonas's AUSD transfer. A returning freelancer skips sign-up: Face ID unlocks the same account and every invoice reappears.

## Functional requirements

Every requirement has an ID, a priority and acceptance criteria written as Given / When / Then. P0 must ship. P1 ships only after all P0 pass. P2 is optional polish. Commits and tests reference these IDs.

### A. Freelancer onboarding

**KUDI-01 (P0) Sign up with a passkey.** The freelancer creates an account with Face ID, Touch ID or a security key.

- Given a new visitor on a supported browser, when they tap "Create account" and pass the biometric prompt, then a passkey is created via `createPasskeyWithPrfOutput` and the home address (index 0) appears on screen within 2 s.
- The words "seed phrase", "private key" and "mnemonic" never appear in the UI.
- The passkey credential ID and display name are saved to localStorage so the next sign-in skips the passkey picker.

**KUDI-02 (P0) Sign back in.** A returning freelancer unlocks the same account with the same passkey.

- Given a freelancer who signed up before, when they tap "Sign in" and pass the biometric prompt, then the same home address is derived and their clients and invoices reappear.
- Given localStorage was cleared, when they sign in, then the same addresses are still derived (labels may be lost; see KUDI-21).

**KUDI-03 (P0) Unsupported passkey provider.** The app explains clearly when PRF is missing.

- Given the passkey provider does not return PRF, when Mera throws `PRF_UNAVAILABLE`, then the user sees: "This browser can't create a Kudi account. Try Safari on iPhone, or Chrome with Google Password Manager." No raw error text is shown.
- Errors are identified by `MeraError` code via `isMeraError`, never by message text.

**KUDI-04 (P0) Display name.** The freelancer sets a name shown on their invoices.

- Given a signed-in freelancer with no name, when they enter a name of 1 to 40 characters, then it is saved locally and shown on every invoice link they create.

### B. Clients and derived addresses

**KUDI-05 (P0) Add a client.** Each client gets its own receiving address from the same passkey.

- Given a signed-in freelancer, when they add a client named "Acme GmbH", then the next unused index (1, 2, 3 and so on) is assigned and its address is derived from the passkey output.
- The address is shown truncated (`0x1234...abcd`) with a copy button.
- Two clients never share an index or address.

**KUDI-06 (P0) Client list with balances.** The dashboard shows what each client has paid.

- Given 1 or more clients, when the dashboard loads, then each row shows client name, short address and AUSD balance read live from the chain.
- A total row shows the sum across all client addresses.
- Balances refresh at least every 5 s while the page is open.

### C. Invoices

**KUDI-07 (P0) Create an invoice.** The freelancer creates an invoice for a client.

- Given a client, when the freelancer enters an amount (0.01 to 1,000,000 AUSD, up to 2 decimals) and an optional memo (max 80 characters), then an invoice is created with a unique ID, status "Unpaid", and the current block number recorded.
- The amount is converted to base units using `decimals()` read from the AUSD contract, never a hardcoded value.

**KUDI-08 (P0) Share the pay link.** The freelancer shares one link per invoice.

- Given an invoice, when the freelancer taps "Copy link" or "Share", then a link in the format defined in the Data model section is copied, or the native share sheet opens on mobile.
- The link opens correctly on a different device with no prior state.

**KUDI-09 (P0) Invoice list.** The freelancer sees every invoice and its status.

- Given invoices exist, when the dashboard loads, then each shows client, amount, memo, status (Unpaid / Paid / Underpaid) and, if paid, a link to the transaction on the testnet explorer.
- Newest invoices appear first.

### D. Client payment

**KUDI-10 (P0) Pay page.** The client sees exactly what they are paying.

- Given a valid pay link, when the client opens it, then they see the freelancer's name, the amount in AUSD, the memo, and the receiving address in short form.
- Given an invalid or tampered link (bad address, amount missing or not a positive integer), then the page shows "This invoice link is broken. Ask for a new one." and no pay button.

**KUDI-11 (P0) Connect wallet and network.** The client connects an injected wallet on Monad testnet.

- Given a browser wallet, when the client taps "Pay", then the wallet connects and, if needed, prompts to add or switch to Monad testnet (chain ID 10143).
- Given no wallet is installed, then the page says "Open this link in a browser with a crypto wallet, like MetaMask."

**KUDI-12 (P0) Balance checks before paying.** The client is warned before a doomed transaction.

- Given a connected wallet, when its AUSD balance is below the invoice amount, then the pay button is disabled and shows "Not enough AUSD".
- When its MON balance is zero, then the pay button is disabled and shows "Add testnet MON for gas" with a link to the official faucet.

**KUDI-13 (P0) Send the payment.** One tap sends the exact amount.

- Given sufficient balances, when the client confirms, then an ERC-20 `transfer(to, amount)` is sent on the AUSD contract to the client's derived address.
- While pending, the button shows "Sending..." and is disabled to stop double payment.
- On confirmation, the page shows "Paid" with a link to the transaction on the testnet explorer.
- On rejection or revert, the page shows a plain-language reason and a retry button.

### E. Live receipt

**KUDI-14 (P0) Payment detection.** The freelancer's screen updates on its own.

- Given an unpaid invoice open on the freelancer's dashboard, when an AUSD `Transfer` to that client address lands at or after the invoice's recorded block, then the invoice flips to "Paid" within 3 s of the block.
- Matching rule: the oldest unpaid invoice for that client whose amount equals the transfer value is marked paid first.
- A transfer smaller than the oldest open invoice marks it "Underpaid" and shows the amount received.

**KUDI-15 (P0) Paid moment.** The receipt is the demo's memorable moment.

- Given an invoice turns Paid, then the freelancer sees a full-width confirmation: "Paid by Acme GmbH, 50.00 AUSD" plus the transaction link and the time it took from link creation.

### F. Test funds and polish

**KUDI-16 (P1) Get test AUSD.** The pay page helps the client get test AUSD from Agora's faucet contract.

- Only built once the faucet's function name and arguments are read from its verified ABI. If it is not verified, this requirement is dropped and the README gives manual steps.

**KUDI-17 (P1) Signed invoices.** Invoices are signed so the client can trust them.

- The freelancer's client-address key signs the invoice payload. The pay page verifies the signature and shows "Verified invoice from Ada". A link with a bad signature shows a warning.

**KUDI-18 (P1) Recent activity.** The dashboard lists the last 10 incoming AUSD transfers across all client addresses.

**KUDI-19 (P2) QR code** for each pay link.

**KUDI-20 (P2) Dark mode.**

**KUDI-21 (P2) Label recovery.** Client names are embedded in invoice links so a freelancer on a new device can rebuild labels from links they shared.

## Technical architecture

Kudi is a static web app with no backend. Two browsers talk to one chain, and a URL carries the invoice between them.

&#91;embedded content: architecture · two browsers, one chain, no server\]

The dashboard reads balances and `Transfer` logs through the RPC. The client's wallet sends one `transfer` to the AUSD contract. The pay link moves from Ada to Jonas as a plain URL, over any chat app.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Fast to scaffold, deploys to Vercel in one step |
| Styling | Tailwind CSS | Speed; mobile-first layout |
| Chain client | viem with a fallback transport | Required by Mera's viem adapter; typed ERC-20 calls |
| Passkeys | `@category-labs/mera`, `@scure/bip32`, `@scure/bip39` | Passkey to EVM accounts with no contracts, bundler or MPC |
| Client wallet | wagmi with the injected connector | MetaMask and similar on the pay page only |
| Hosting | Vercel over HTTPS | Passkeys need HTTPS and a fixed `rpId` |

**Routes**

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Freelancer | Landing, create account, sign in |
| `/app` | Freelancer | Dashboard: clients, invoices, live receipts |
| `/pay` | Client | Decode link, connect wallet, pay |
| `/debug` | Builder | Phase 0 chain check; deleted before submission |

**Module layout**

- `lib/config.ts`: chain, RPC URLs, AUSD and faucet addresses, explorer base URL.
- `lib/passkey.ts`: create, sign in, PRF errors, derive address at index.
- `lib/ausd.ts`: decimals, balance, transfer, `Transfer` log scan and watch.
- `lib/invoice.ts`: build, encode, decode and validate pay links; matching rule.
- `lib/store.ts`: typed localStorage read and write with try/catch.

## Data model, link format and addresses

Kudi stores nothing on a server. Truth lives in three places: the chain (balances, transfers), the invoice link (what is owed), and the freelancer's browser (labels and invoice list).

### Network and contracts

| Item | Value | Source |
| --- | --- | --- |
| Network | Monad Testnet, chain ID 10143 | [Mera guide](https://docs.monad.xyz/guides/mera) |
| RPC | `https://testnet-rpc.monad.xyz` (plus one fallback) | Monad docs |
| AUSD token (testnet) | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | [Agora deployments](https://docs.agora.finance/developer/contract-deployments) |
| AUSD faucet (testnet) | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` | [Agora deployments](https://docs.agora.finance/developer/contract-deployments) |
| Explorer | `https://testnet.monadscan.com` | Monad docs |
| Mera package | `@category-labs/mera` with `viem`, `@scure/bip32`, `@scure/bip39` | [Mera guide](https://docs.monad.xyz/guides/mera) |

All of these live in one config file and `.env`. Switching to mainnet later means changing that file only.

### Key derivation

- Mera returns 32 secret bytes from the passkey (PRF output). Those bytes derive a standard BIP-44 account; incrementing the index gives more accounts from the same passkey.
- Index 0 = the freelancer's home address. Index 1, 2, 3 and up = one per client, in the order clients are added.
- Kudi derives only addresses for display and watching. It holds no key in memory except during a KUDI-17 signature, and zeroes it right after.

### Browser storage (localStorage, key `kudi:v1`)

```json
{
  "credentialId": "base64url",
  "displayName": "Ada Okafor",
  "homeAddress": "0x...",
  "clients": [
    { "index": 1, "name": "Acme GmbH", "address": "0x...", "createdAt": 1760300000 }
  ],
  "invoices": [
    { "id": "inv_8f3k2", "clientIndex": 1, "amount": "50000000", "memo": "October design work",
      "createdBlock": 123456, "status": "unpaid", "paidTx": null, "paidAmount": null }
  ]
}
```

Amounts are stored as base-unit strings, never floats. Every read and write is wrapped in try/catch; the app must render with empty storage.

### Pay link format

```
https://<host>/pay?v=1&to=<address>&amt=<baseUnits>&inv=<id>&n=<freelancerName>&c=<clientName>&m=<memo>&b=<createdBlock>&sig=<signature>
```

| Param | Required | Rule |
| --- | --- | --- |
| `v` | Yes | Link version, `1` |
| `to` | Yes | Valid checksummed address |
| `amt` | Yes | Positive integer in base units |
| `inv` | Yes | Invoice ID, 5 to 16 URL-safe characters |
| `n` | Yes | Freelancer display name, URL-encoded, max 40 |
| `c` | No | Client name, max 40 |
| `m` | No | Memo, max 80 |
| `b` | Yes | Block number when the invoice was created |
| `sig` | P1 only | EIP-191 signature over the other params, from the client-address key |

### On-chain reads and writes

- **Reads:** `decimals()`, `symbol()`, `balanceOf(address)` on AUSD; `Transfer` logs filtered by `to` = client address from block `b`.
- **Write (client only):** `transfer(to, amt)` on AUSD from the client's wallet. This is the only transaction in the product.

## Edge cases and failure states

Every failure gets a plain-language message and a next action. No raw error objects, hex strings or stack traces ever reach the screen.

| # | Situation | What the user sees | What the app does |
| --- | --- | --- | --- |
| E1 | Passkey provider has no PRF | "This browser can't create a Kudi account. Try Safari on iPhone, or Chrome with Google Password Manager." | Stops sign-up, keeps the page usable |
| E2 | User cancels the biometric prompt | "Sign-up cancelled. Tap to try again." | Nothing is saved |
| E3 | Desktop Chrome saves passkey to local profile | Same as E1 | Catches `PRF_UNAVAILABLE` by code |
| E4 | Pay link opened with no wallet | "Open this link in a browser with a crypto wallet, like MetaMask." | Shows invoice details, hides pay button |
| E5 | Client on wrong network | Wallet prompt to switch to Monad testnet | Blocks payment until chain ID is 10143 |
| E6 | Client lacks AUSD | "Not enough AUSD" on a disabled button | Shows faucet help (KUDI-16 if built) |
| E7 | Client has no MON for gas | "Add testnet MON for gas" with faucet link | Disabled button |
| E8 | Client taps Pay twice | Button disabled after first tap | Only one transaction sent |
| E9 | Transaction rejected in wallet | "Payment cancelled. Nothing was sent." | Retry button |
| E10 | Transaction reverts | "Payment failed on-chain. Nothing was sent." plus explorer link | Retry button |
| E11 | Client pays less than invoiced | Freelancer sees "Underpaid: received 30.00 of 50.00 AUSD" | Status Underpaid |
| E12 | Client pays more than invoiced | Invoice marked Paid; extra shown as "+20.00 AUSD extra" | No refund logic |
| E13 | Same client pays the same invoice twice | First transfer marks it Paid; second appears in Recent activity only | Matching rule from KUDI-14 |
| E14 | Tampered or malformed link | "This invoice link is broken. Ask for a new one." | No pay button |
| E15 | Primary RPC slow or down | No visible error unless both fail; then "Network is busy, retrying..." | viem fallback transport with retry and backoff |
| E16 | localStorage cleared or private window | Sign-in still works; client names show as "Client 1", "Client 2" | Re-derives addresses for indexes with on-chain activity |
| E17 | Freelancer opens dashboard after payment already landed | Invoice already shows Paid on load | Log scan from block `b` on every load, not just live watch |
| E18 | Monad RPC returns logs out of block-internal order | No visible effect | Sort logs by block number and log index before matching |

## Non-functional requirements

The demo cannot fail. Every non-functional requirement below serves that rule.

| ID | Area | Requirement | Check |
| --- | --- | --- | --- |
| NFR-01 | Reliability | The only external dependency in the payment path is the Monad RPC. No price APIs, no backend, no analytics calls. | Code review: grep for `fetch(` and external hosts |
| NFR-02 | Reliability | viem client uses a fallback transport (two RPC URLs) with retry. | Kill primary URL in `.env`, flow still works |
| NFR-03 | Speed | Paid status appears within 3 s of the transfer's block. Poll logs every 1.5 s or use a WebSocket watch. | Timed on rehearsal |
| NFR-04 | Speed | Dashboard first paint under 1.5 s on a mid-range phone over 4G. | Lighthouse mobile |
| NFR-05 | Security | Keys derived from the passkey are never written to storage, never logged, and zeroed after use. | Grep for `console.log`; review derive code |
| NFR-06 | Security | Passkey `rpId` = the deployed domain. Local dev uses `localhost`. Never `127.0.0.1`. | Sign-up works on the deployed URL |
| NFR-07 | Security | `.env`, wallet files and any test private key are gitignored and absent from git history. | `git log -p` scan before submission |
| NFR-08 | Correctness | All token math uses `bigint` base units. No floats. Decimals read from the contract. | Unit test: 0.01, 50, 1,000,000 AUSD round-trip |
| NFR-09 | Gas | Monad charges the declared gas limit, not gas used, so the client transfer uses viem's estimate without padding it heavily. | Inspect gas on a test tx |
| NFR-10 | Compatibility | Freelancer flow works on iPhone Safari (iOS 18+) with iCloud Keychain. Client flow works in desktop Chrome with MetaMask. | Both tested before recording |
| NFR-11 | Hosting | Deployed over HTTPS (passkeys require it), e.g. Vercel. | Live URL in README |
| NFR-12 | Accessibility | Buttons at least 44 px tall, text contrast AA, every status also shown in words, not colour alone. | Manual check |
| NFR-13 | Copy | No crypto jargon on freelancer screens: say "dollars (AUSD)", "account", "payment". Never "wallet", "gas", "seed" on the freelancer side. | Copy review |

## Build phases

Eight phases, each built on the one before. A phase is done only when its check passes. Commit after every phase with the requirement IDs in the message.

1. **Phase 0: Scaffold and chain.** Next.js (App Router) + TypeScript + Tailwind + viem. One config file with the addresses from the Data model section. A debug page reads AUSD `symbol()` and `decimals()` on testnet.
   - Check: the page prints the token symbol and its decimals from chain.
2. **Phase 1: Passkey account (KUDI-01 to 04).** Sign up, sign in, PRF error handling, display name, home address shown.
   - Check: sign up on iPhone Safari, close the tab, sign in again, same address appears.
3. **Phase 2: Clients (KUDI-05, 06).** Add clients, derive addresses by index, live balances, total row.
   - Check: three clients show three different addresses; sending test AUSD to one updates only that row.
4. **Phase 3: Invoices (KUDI-07 to 09).** Create invoice, record block, build link, copy and share, invoice list.
   - Check: a copied link opens on a second device and decodes every field.
5. **Phase 4: Pay page (KUDI-10 to 13).** Decode and validate link, connect wallet, switch chain, balance checks, transfer, success and failure states.
   - Check: a real AUSD transfer confirms on testnet and its explorer link opens.
6. **Phase 5: Live receipt (KUDI-14, 15).** Log scan on load plus live watch, matching rule, Underpaid state, full-width Paid moment.
   - Check: with dashboard and pay page side by side, Paid appears within 3 s of the block.
7. **Phase 6: Hardening.** Every edge case E1 to E18, fallback RPC, copy review, mobile layout, deploy to HTTPS.
   - Check: run the full flow 5 times on the deployed URL with no code change.
8. **Phase 7: P1 items, then submission.** KUDI-16 to 18 only if time allows. Then README with at least 3 real tx hashes, cleanup, demo video.
   - Check: the submission checklist in the Rules section passes.

If time runs short, cut from the bottom. P1 items go first, then Phase 6 polish. Phases 0 to 5 are the product.

## 90-second demo

The demo is a split screen: the freelancer's iPhone on the left, the client's laptop on the right. It must make sense with the sound off.

| Time | Left: freelancer (iPhone) | Right: client (laptop) | On-screen caption |
| --- | --- | --- | --- |
| 0 to 10 s | Taps "Create account", Face ID | Idle | "No seed phrase. Just your face." |
| 10 to 20 s | Account ready, enters name "Ada" | Idle | "Account created in 4 seconds" |
| 20 to 30 s | Adds client "Acme GmbH"; new address appears | Idle | "Every client gets their own address. One passkey." |
| 30 to 40 s | Creates invoice: 50 AUSD, "October design work"; taps Share | Idle | "One link per invoice" |
| 40 to 55 s | Waiting | Opens link, sees "Ada, 50.00 AUSD", connects MetaMask | "Client sees exactly what they owe" |
| 55 to 65 s | Waiting | Taps Pay, confirms in MetaMask | "Real AUSD on Monad testnet" |
| 65 to 75 s | Full-screen "Paid by Acme GmbH, 50.00 AUSD" | "Paid" with explorer link | "Settled in under a second" |
| 75 to 90 s | Taps tx link; explorer shows the transfer | Explorer tab | "Get paid from anywhere, in real dollars, with your face." |

**The one moment judges remember:** the iPhone flipping to "Paid" the instant the client confirms. Rehearse until that cut is clean.

**Fallback:** record the demo in advance. Never rely on a live run during judging.

## Risks and mitigations

The biggest risk is time, not technology. Each risk below has a fallback that keeps the core flow alive.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Deadline hits before Phase 5 is done | Medium | Fatal | Strict phase order; cut P1 and polish first; no new ideas mid-build |
| Passkey PRF fails on the demo device | Medium | High | Test the Mera demo on the iPhone tonight; record the demo in advance |
| Can't get testnet AUSD from the faucet | Medium | High | Read faucet ABI first; ask in Monad and Agora Discord; worst case, document the blocker honestly and use a clearly labelled mock |
| Mera derivation API differs from what this PRD assumes | Medium | Medium | Agent reads Mera docs and source before Phase 1; PRD names behaviour, not function signatures beyond those confirmed |
| Monad testnet RPC slow or rate-limited | Low | Medium | Fallback transport; retries; recorded demo |
| Judges see Kudi as a copy of Polaris | Medium | Medium | Lead with real AUSD, the freelancer user, and per-client addresses in the first 15 s of the video |
| Testnet not accepted for prizes | Low | High | Rules don't require mainnet; mainnet switch is one config file; optional single mainnet tx for proof |

## Open questions

These must be answered before the phase that needs them. The answer goes into this doc's change log.

- [ ] What is the exact submission cutoff time and timezone? (Owner: Bholdguyyy, check the portal. Blocks all planning.)
- [ ] What is the AUSD faucet contract's function name and arguments? Is it verified on the explorer? (Owner: Bholdguyyy. Blocks test funds and KUDI-16.)
- [ ] Does testnet AUSD return 6 decimals like mainnet? (Owner: coding agent, read `decimals()` in Phase 0.)
- [ ] Which Mera helper derives a BIP-44 account at a given index from PRF output? (Owner: coding agent, read Mera docs and source before Phase 1.)
- [ ] Does the iPhone used for the demo return PRF with iCloud Keychain? (Owner: Bholdguyyy, test the Mera demo tonight.)
- [ ] What domain will host the app? It becomes the passkey `rpId` and cannot change without breaking existing passkeys. (Owner: Bholdguyyy, decide before Phase 1 is deployed.)

## Rules for the coding agent

This PRD is the authority. When the PRD and a guess disagree, the PRD wins. When the PRD is silent, ask.

**Before writing any code in a phase, return four things:** your interpretation of the phase, unresolved questions, assumptions you propose, and an ordered plan. Wait for approval.

**While building**

- Build only what the current phase lists. Nothing from Non-goals, ever.
- Reference requirement IDs (KUDI-xx, NFR-xx, Ex) in commit messages and test names.
- Never invent a contract address, ABI function or library function. Read it from docs, source or the explorer, or ask.
- Never hardcode token decimals, addresses or RPC URLs outside the config file.
- No mock data, placeholder text or fake transactions in the final build.
- No `console.log`, TODOs or commented-out code at submission.
- Every async call has a loading state, an error state and a plain-language message.
- Keep the freelancer side free of crypto jargon (NFR-13).
- If stuck for more than two attempts, stop, explain the problem simply, and propose three small fixes.

**Submission checklist**

- [ ] Git identity set to Bholdguyyy's own account before the first commit
- [ ] `.env` and keys never committed; history clean
- [ ] Agent instruction file renamed to `AGENTS.md`; planning files deleted
- [ ] README order: pitch, architecture diagram, live tx hashes with explorer links, how to run, AI tools used
- [ ] Deployed HTTPS URL works on iPhone Safari
- [ ] Demo video under 3 minutes, recorded, not live

## Change log

| Date | Change |
| --- | --- |
| 2026-10-12 | v1 drafted. Locked testnet, real Agora testnet AUSD, receive-only freelancer, no backend. |

## Sources

- [Metropolis hackathon page](https://monad.xyz/developers/hackathons/metropolis)
- [Agora AUSD contract deployments](https://docs.agora.finance/developer/contract-deployments)
- [Mera passkey guide, Monad docs](https://docs.monad.xyz/guides/mera)
- [category-labs/mera repo](https://github.com/category-labs/mera)
- [Polaris on Monad](https://github.com/nickthelegend/polaris-monad)
- [How to give AI agents a PRD, Verdent](https://www.verdent.ai/guides/answers/give-ai-agents-prd)
- [What is a PRD, Plannotator](https://docs.plannotator.ai/learn/planning/what-is-a-product-requirements-document)
