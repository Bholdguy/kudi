import { describe, expect, it } from "vitest";
import { formatElapsed, shortAddress } from "@/lib/format";

describe("KUDI-15 elapsed time wording", () => {
  it("counts seconds, minutes, hours and days in whole units", () => {
    expect(formatElapsed(0)).toBe("0 seconds");
    expect(formatElapsed(1)).toBe("1 second");
    expect(formatElapsed(42)).toBe("42 seconds");
    expect(formatElapsed(60)).toBe("1 minute");
    expect(formatElapsed(185)).toBe("3 minutes");
    expect(formatElapsed(3600)).toBe("1 hour");
    expect(formatElapsed(7300)).toBe("2 hours");
    expect(formatElapsed(86_400)).toBe("1 day");
    expect(formatElapsed(5 * 86_400 + 10)).toBe("5 days");
  });

  it("never goes negative when the clocks disagree", () => {
    expect(formatElapsed(-30)).toBe("0 seconds");
  });
});

describe("short addresses", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0xA586108FeA48130F1e9FAa634Dace29867629A39")).toBe("0xA586...9A39");
  });
});
