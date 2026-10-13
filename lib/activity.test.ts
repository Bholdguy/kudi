import { describe, expect, it } from "vitest";
import { recentActivity } from "@/lib/activity";
import { config } from "@/lib/config";
import type { StoredClient, StoredTransfer } from "@/lib/store";

function transfer(block: number, logIndex: number, value = "1000000"): StoredTransfer {
  return { block, logIndex, tx: `0xtx${block}_${logIndex}`, value, timestamp: 1_000_000 + block };
}

function client(index: number, name: string, transfers?: StoredTransfer[]): StoredClient {
  return {
    index,
    name,
    address: `0x${String(index).padStart(40, "0")}`,
    createdAt: 1,
    ...(transfers ? { scan: { through: 0, transfers } } : {}),
  };
}

describe("KUDI-18 recent activity", () => {
  it("lists transfers across all clients, newest first, with the client's name", () => {
    const items = recentActivity([
      client(1, "Acme", [transfer(100, 0), transfer(300, 0)]),
      client(2, "Beta", [transfer(200, 0)]),
    ]);
    expect(items.map((i) => [i.block, i.clientName])).toEqual([
      [300, "Acme"],
      [200, "Beta"],
      [100, "Acme"],
    ]);
  });

  it("E18: within a block, the later log index comes first, whatever order the logs were stored in", () => {
    const forward = recentActivity([client(1, "Acme", [transfer(100, 2), transfer(100, 9)])]);
    const backward = recentActivity([client(1, "Acme", [transfer(100, 9), transfer(100, 2)])]);
    expect(forward.map((i) => i.logIndex)).toEqual([9, 2]);
    expect(backward).toEqual(forward);
  });

  it("is limited to the last 10", () => {
    const many = Array.from({ length: 25 }, (_, i) => transfer(100 + i, 0));
    const items = recentActivity([client(1, "Acme", many)]);
    expect(config.recentActivityLimit).toBe(10);
    expect(items).toHaveLength(10);
    expect(items[0].block).toBe(124);
    expect(items[9].block).toBe(115);
  });

  it("E13: a second payment for an already paid invoice still appears", () => {
    const items = recentActivity([client(1, "Acme", [transfer(100, 0, "50000000"), transfer(110, 0, "50000000")])]);
    expect(items).toHaveLength(2);
  });

  it("shows each transfer once even if it is cached twice", () => {
    const t = transfer(100, 0);
    expect(recentActivity([client(1, "Acme", [t, t])])).toHaveLength(1);
  });

  it("is empty when nothing has been scanned yet", () => {
    expect(recentActivity([client(1, "Acme"), client(2, "Beta", [])])).toEqual([]);
    expect(recentActivity([])).toEqual([]);
  });
});
