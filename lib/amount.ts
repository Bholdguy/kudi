import { config } from "@/lib/config";

const DISPLAY_DECIMALS = config.amountFractionDigits;

/**
 * Formats base units for display with exactly 2 decimals, truncating (never
 * rounding up) and grouping thousands. Pure bigint math, no floats.
 */
export function formatAmount(units: bigint, decimals: number): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const fraction = abs % scale;

  let cents: string;
  if (decimals >= DISPLAY_DECIMALS) {
    const cut = 10n ** BigInt(decimals - DISPLAY_DECIMALS);
    cents = (fraction / cut).toString().padStart(DISPLAY_DECIMALS, "0");
  } else {
    cents = (fraction * 10n ** BigInt(DISPLAY_DECIMALS - decimals))
      .toString()
      .padStart(DISPLAY_DECIMALS, "0");
  }

  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${cents}`;
}

export type ParsedAmount =
  | { ok: true; units: bigint }
  | { ok: false; reason: "empty" | "format" | "too_many_decimals" | "too_small" | "too_large" };

/**
 * Parses what a person typed, such as "50" or "50.25", into base units.
 * Accepts 0.01 up to the configured maximum, with at most 2 decimals.
 * Pure bigint math, no floats.
 */
export function parseAmount(text: string, decimals: number): ParsedAmount {
  const input = text.trim();
  if (input === "") return { ok: false, reason: "empty" };
  if (!/^\d+(\.\d+)?$/.test(input)) return { ok: false, reason: "format" };

  const [whole, fraction = ""] = input.split(".");
  const fractionDigits = Math.min(DISPLAY_DECIMALS, decimals);
  if (fraction.length > fractionDigits) return { ok: false, reason: "too_many_decimals" };

  const scale = 10n ** BigInt(decimals);
  const units = BigInt(whole) * scale + BigInt(fraction.padEnd(decimals, "0") || "0");
  const smallest = 10n ** BigInt(decimals - fractionDigits);
  if (units < smallest) return { ok: false, reason: "too_small" };
  if (units > BigInt(config.invoiceMaxWholeAmount) * scale) return { ok: false, reason: "too_large" };
  return { ok: true, units };
}
