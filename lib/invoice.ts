import { getAddress, isAddress, type Address } from "viem";
import { config } from "@/lib/config";
import { parseNetwork, type NetworkKey } from "@/lib/chains";
import type { StoredClient, StoredInvoice } from "@/lib/store";

// No look-alike characters (0, o, 1, l, i), 32 symbols so a masked byte is unbiased.
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID_PATTERN = /^[A-Za-z0-9_-]{5,16}$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const NON_NEGATIVE_INTEGER = /^(0|[1-9]\d*)$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_UINT256 = 2n ** 256n - 1n;
const SALT_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export type PayLink = {
  to: Address;
  /** Base units at the token's ERC-20 decimals (6 for both AUSD and USDC). */
  amt: bigint;
  inv: string;
  n: string;
  c: string;
  m: string;
  b: number;
  network: NetworkKey;
  /** The KudiPay salt. Required for Arc links, absent for Monad links. */
  salt: string | null;
};

/** Only Monad invoices are matched against AUSD transfers on Monad. */
export function isMonadInvoice(invoice: StoredInvoice): boolean {
  return invoice.network === "monad";
}

/** A random 32-byte salt, as 0x-prefixed hex. */
export function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type ParsedPayLink = { ok: true; link: PayLink } | { ok: false };

export function generateInvoiceId(): string {
  const bytes = new Uint8Array(config.invoiceIdRandomLength);
  crypto.getRandomValues(bytes);
  let id = config.invoiceIdPrefix;
  for (const byte of bytes) id += ID_ALPHABET[byte & (ID_ALPHABET.length - 1)];
  return id;
}

export function buildInvoice(args: {
  id: string;
  client: StoredClient;
  amount: bigint;
  memo: string;
  createdBlock: number;
  nowSeconds: number;
  network: NetworkKey;
  salt: string | null;
}): StoredInvoice {
  return {
    id: args.id,
    network: args.network,
    salt: args.salt,
    clientIndex: args.client.index,
    amount: args.amount.toString(),
    memo: args.memo,
    createdBlock: args.createdBlock,
    createdAt: args.nowSeconds,
    status: "unpaid",
    paidTx: null,
    paidAmount: null,
    paidAt: null,
  };
}

export function buildPayLink(origin: string, link: PayLink): string {
  const params = new URLSearchParams();
  params.set("v", config.linkVersion);
  params.set("to", link.to);
  params.set("amt", link.amt.toString());
  params.set("inv", link.inv);
  params.set("n", link.n);
  params.set("chain", link.network);
  if (link.salt !== null) params.set("s", link.salt);
  if (link.c !== "") params.set("c", link.c);
  if (link.m !== "") params.set("m", link.m);
  params.set("b", String(link.b));
  return `${origin}/pay?${params.toString()}`;
}

function cleanText(value: string | null, max: number, required: boolean): string | null {
  if (value === null) return required ? null : "";
  if (value.length > max || CONTROL_CHARACTERS.test(value)) return null;
  if (required && value.trim() === "") return null;
  return value;
}

/** Validates a pay link's query string. Anything off at all makes the whole link broken (E14). */
export function parsePayLink(search: string | URLSearchParams): ParsedPayLink {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const broken: ParsedPayLink = { ok: false };

  if (params.get("v") !== config.linkVersion) return broken;

  const to = params.get("to");
  if (to === null || !isAddress(to)) return broken;

  const amtText = params.get("amt");
  if (amtText === null || !POSITIVE_INTEGER.test(amtText)) return broken;
  const amt = BigInt(amtText);
  if (amt > MAX_UINT256) return broken;

  const inv = params.get("inv");
  if (inv === null || !ID_PATTERN.test(inv)) return broken;

  const n = cleanText(params.get("n"), config.displayNameMaxLength, true);
  const c = cleanText(params.get("c"), config.displayNameMaxLength, false);
  const m = cleanText(params.get("m"), config.memoMaxLength, false);
  if (n === null || c === null || m === null) return broken;

  const bText = params.get("b");
  if (bText === null || !NON_NEGATIVE_INTEGER.test(bText)) return broken;
  const b = Number(bText);
  if (!Number.isSafeInteger(b)) return broken;

  const network = parseNetwork(params.get("chain"));
  let salt: string | null = null;
  if (network === "arc") {
    const saltText = params.get("s");
    if (saltText === null || !SALT_PATTERN.test(saltText)) return broken;
    salt = saltText;
  }

  return { ok: true, link: { to: getAddress(to), amt, inv, n, c, m, b, network, salt } };
}
