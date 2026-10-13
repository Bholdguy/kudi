export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "42 seconds", "3 minutes", "2 hours", "5 days". Whole units, rounded down. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return plural(seconds, "second");
  if (seconds < 3600) return plural(Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return plural(Math.floor(seconds / 3600), "hour");
  return plural(Math.floor(seconds / 86_400), "day");
}
