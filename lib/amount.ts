const DISPLAY_DECIMALS = 2;

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
