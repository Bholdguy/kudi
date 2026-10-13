import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { nextFailureCount, showBusyMessage } from "@/lib/retry";

describe("E15 no visible error until the network keeps failing", () => {
  it("one failed attempt shows nothing", () => {
    expect(showBusyMessage(nextFailureCount(0, false))).toBe(false);
  });

  it("two failures in a row show 'Network is busy, retrying...'", () => {
    const afterTwo = nextFailureCount(nextFailureCount(0, false), false);
    expect(afterTwo).toBe(2);
    expect(showBusyMessage(afterTwo)).toBe(true);
  });

  it("a success in between resets the count", () => {
    let failures = nextFailureCount(0, false);
    failures = nextFailureCount(failures, true);
    failures = nextFailureCount(failures, false);
    expect(failures).toBe(1);
    expect(showBusyMessage(failures)).toBe(false);
  });

  it("the threshold comes from config and is two", () => {
    expect(config.errorGraceFailures).toBe(2);
  });
});
