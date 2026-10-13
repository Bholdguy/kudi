import { config } from "@/lib/config";

/** Consecutive failed attempts so far, after one more attempt that did or did not succeed. */
export function nextFailureCount(previous: number, succeeded: boolean): number {
  return succeeded ? 0 : previous + 1;
}

/** The "Network is busy" message appears only after several failures in a row (E15). */
export function showBusyMessage(
  failures: number,
  grace: number = config.errorGraceFailures,
): boolean {
  return failures >= grace;
}
