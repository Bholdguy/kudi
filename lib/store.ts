import { config } from "@/lib/config";

export type StoredClient = {
  index: number;
  name: string;
  address: string;
  createdAt: number;
};

export type StoredInvoice = {
  id: string;
  clientIndex: number;
  amount: string;
  memo: string;
  createdBlock: number;
  status: "unpaid" | "paid" | "underpaid";
  paidTx: string | null;
  paidAmount: string | null;
};

export type StoredState = {
  credentialId: string;
  transports: string[];
  displayName: string;
  homeAddress: string;
  accountXpub: string;
  clients: StoredClient[];
  invoices: StoredInvoice[];
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseState(value: unknown): StoredState | null {
  if (!isRecord(value)) return null;
  const { credentialId, transports, displayName, homeAddress, accountXpub } = value;
  if (typeof credentialId !== "string" || credentialId.length === 0) return null;
  if (typeof homeAddress !== "string" || !ADDRESS_PATTERN.test(homeAddress)) return null;
  if (typeof accountXpub !== "string" || accountXpub.length === 0) return null;
  return {
    credentialId,
    transports: Array.isArray(transports)
      ? transports.filter((t): t is string => typeof t === "string")
      : [],
    displayName: typeof displayName === "string" ? displayName : "",
    homeAddress,
    accountXpub,
    clients: Array.isArray(value.clients) ? (value.clients as StoredClient[]) : [],
    invoices: Array.isArray(value.invoices) ? (value.invoices as StoredInvoice[]) : [],
  };
}

let memoryState: StoredState | null = null;
let memorySignedIn = false;
const listeners = new Set<() => void>();
let cache: { raw: string | null; memory: StoredState | null; value: StoredState | null } | null =
  null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(config.storageKey);
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): StoredState | null {
  if (!raw) return null;
  try {
    return parseState(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Stable between changes, as useSyncExternalStore requires.
export function getStateSnapshot(): StoredState | null {
  const raw = readRaw();
  if (cache && cache.raw === raw && cache.memory === memoryState) return cache.value;
  const value = parseRaw(raw) ?? memoryState;
  cache = { raw, memory: memoryState, value };
  return value;
}

export function getServerStateSnapshot(): StoredState | null {
  return null;
}

export function loadState(): StoredState | null {
  return getStateSnapshot();
}

export function saveState(state: StoredState): void {
  memoryState = state;
  try {
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  } catch {
    // Storage unavailable (private window): the account lives for this tab only.
  }
  notify();
}

export function clearState(): void {
  memoryState = null;
  try {
    localStorage.removeItem(config.storageKey);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  notify();
}

// The signed-in flag lives in sessionStorage, so closing the tab means
// signing in again. It holds no account data.
export function getSignedInSnapshot(): boolean {
  try {
    return sessionStorage.getItem(config.sessionKey) === "1";
  } catch {
    return memorySignedIn;
  }
}

export function getServerSignedInSnapshot(): boolean {
  return false;
}

export function setSignedIn(signedIn: boolean): void {
  memorySignedIn = signedIn;
  try {
    if (signedIn) sessionStorage.setItem(config.sessionKey, "1");
    else sessionStorage.removeItem(config.sessionKey);
  } catch {
    // Storage unavailable: the in-memory flag covers this tab.
  }
  notify();
}
