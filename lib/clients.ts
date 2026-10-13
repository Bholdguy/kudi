import { config } from "@/lib/config";
import { addressAt } from "@/lib/passkey";
import type { StoredClient } from "@/lib/store";

/** Index 0 is the home address, so client indexes start at 1. */
const FIRST_CLIENT_INDEX = 1;

export function validateClientName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 1 || name.length > config.displayNameMaxLength) return null;
  return name;
}

export function nextClientIndex(clients: readonly StoredClient[]): number {
  return clients.reduce(
    (next, client) => Math.max(next, client.index + 1),
    FIRST_CLIENT_INDEX,
  );
}

/** The address a client's index derives to. The UI trusts this, not the stored copy. */
export function clientAddress(accountXpub: string, client: StoredClient): string {
  return addressAt(accountXpub, client.index);
}

export function buildClient(
  accountXpub: string,
  clients: readonly StoredClient[],
  name: string,
  nowSeconds: number,
): StoredClient {
  const index = nextClientIndex(clients);
  return { index, name, address: addressAt(accountXpub, index), createdAt: nowSeconds };
}
