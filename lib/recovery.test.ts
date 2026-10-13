import { beforeEach, describe, expect, it, vi } from "vitest";

const readBalances = vi.fn();
vi.mock("@/lib/ausd", () => ({ readBalances: (...args: unknown[]) => readBalances(...args) }));

import { config } from "@/lib/config";
import { accountFromPrfOutput, addressAt } from "@/lib/passkey";
import { buildRecoveredClients, recoverClients, recoveredClientCount } from "@/lib/recovery";

const { accountXpub, homeAddress } = accountFromPrfOutput(Uint8Array.from({ length: 32 }, (_, i) => i));

function balancesWithFunds(funded: Record<number, bigint>): bigint[] {
  return Array.from({ length: config.recoveryProbeCount }, (_, i) => funded[i + 1] ?? 0n);
}

describe("E16 how many clients come back", () => {
  it("none when no client address holds AUSD", () => {
    expect(recoveredClientCount(balancesWithFunds({}))).toBe(0);
  });

  it("one when only client 1 holds AUSD", () => {
    expect(recoveredClientCount(balancesWithFunds({ 1: 10_000_000n }))).toBe(1);
  });

  it("keeps earlier clients that have not paid yet, up to the last funded one", () => {
    expect(recoveredClientCount(balancesWithFunds({ 3: 1n }))).toBe(3);
  });

  it("brings back all 20 when the last probed index holds AUSD", () => {
    expect(recoveredClientCount(balancesWithFunds({ 20: 5n }))).toBe(20);
  });

  it("the probe size is 20", () => {
    expect(config.recoveryProbeCount).toBe(20);
  });
});

describe("E16 rebuilt clients", () => {
  it("are named Client 1, Client 2 and so on, with the right indexes", () => {
    const clients = buildRecoveredClients(accountXpub, 3, 1_760_300_000);
    expect(clients.map((c) => [c.index, c.name])).toEqual([
      [1, "Client 1"],
      [2, "Client 2"],
      [3, "Client 3"],
    ]);
  });

  it("derive the same addresses as before, all different, never the home address", () => {
    const clients = buildRecoveredClients(accountXpub, 3, 1);
    expect(clients.map((c) => c.address)).toEqual([1, 2, 3].map((i) => addressAt(accountXpub, i)));
    expect(new Set(clients.map((c) => c.address)).size).toBe(3);
    expect(clients.map((c) => c.address)).not.toContain(homeAddress);
  });
});

describe("E16 recoverClients", () => {
  beforeEach(() => {
    readBalances.mockReset();
  });

  it("probes exactly the first 20 client addresses in one read", async () => {
    readBalances.mockResolvedValue(balancesWithFunds({}));
    await recoverClients(accountXpub, 1);
    expect(readBalances).toHaveBeenCalledTimes(1);
    const probed = readBalances.mock.calls[0][0] as string[];
    expect(probed).toHaveLength(20);
    expect(probed[0]).toBe(addressAt(accountXpub, 1));
    expect(probed[19]).toBe(addressAt(accountXpub, 20));
  });

  it("returns the funded clients from the chain's balances", async () => {
    readBalances.mockResolvedValue(balancesWithFunds({ 2: 50_000_000n }));
    const clients = await recoverClients(accountXpub, 7);
    expect(clients.map((c) => c.name)).toEqual(["Client 1", "Client 2"]);
    expect(clients[0].createdAt).toBe(7);
  });

  it("returns nothing, without throwing, when the chain cannot be read", async () => {
    readBalances.mockRejectedValue(new Error("RPC down"));
    await expect(recoverClients(accountXpub, 1)).resolves.toEqual([]);
  });
});
