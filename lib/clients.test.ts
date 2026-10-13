import { describe, expect, it } from "vitest";
import { buildClient, clientAddress, nextClientIndex, validateClientName } from "@/lib/clients";
import { accountFromPrfOutput } from "@/lib/passkey";
import type { StoredClient } from "@/lib/store";

const { accountXpub, homeAddress } = accountFromPrfOutput(
  Uint8Array.from({ length: 32 }, (_, i) => i),
);

function addClients(names: string[]): StoredClient[] {
  const clients: StoredClient[] = [];
  for (const name of names) clients.push(buildClient(accountXpub, clients, name, 1_760_300_000));
  return clients;
}

describe("KUDI-05 add a client", () => {
  it("the first client gets index 1, never the home index 0", () => {
    expect(nextClientIndex([])).toBe(1);
  });

  it("clients get indexes 1, 2, 3 in order", () => {
    expect(addClients(["Acme", "Beta", "Gamma"]).map((c) => c.index)).toEqual([1, 2, 3]);
  });

  it("two clients never share an index or an address, and none is the home address", () => {
    const clients = addClients(["Acme", "Beta", "Gamma"]);
    const addresses = clients.map((c) => c.address);
    expect(new Set(addresses).size).toBe(3);
    expect(addresses).not.toContain(homeAddress);
  });

  it("duplicate names are allowed and still get separate addresses", () => {
    const [first, second] = addClients(["Acme", "Acme"]);
    expect(first.address).not.toBe(second.address);
  });

  it("the displayed address is derived from the index, not the stored copy", () => {
    const [client] = addClients(["Acme"]);
    const tampered = { ...client, address: "0x0000000000000000000000000000000000000001" };
    expect(clientAddress(accountXpub, tampered)).toBe(client.address);
  });

  it("the next index follows the highest used index even with gaps", () => {
    const clients = addClients(["A", "B", "C"]).filter((c) => c.index !== 2);
    expect(nextClientIndex(clients)).toBe(4);
  });

  it("names are trimmed and limited to 1 to 40 characters", () => {
    expect(validateClientName("  Acme GmbH  ")).toBe("Acme GmbH");
    expect(validateClientName("   ")).toBeNull();
    expect(validateClientName("x".repeat(40))).toBe("x".repeat(40));
    expect(validateClientName("x".repeat(41))).toBeNull();
  });
});
