import { config } from "@/lib/config";

export type PayAction =
  | "no_wallet"
  | "not_connected"
  | "wrong_chain"
  | "checking"
  | "low_ausd"
  | "low_mon"
  | "ready";

export type PayInputs = {
  hasProvider: boolean;
  account: string | null;
  chainId: number | null;
  /** AUSD base units, null until read. */
  ausd: bigint | null;
  /** Native balance, null until read. */
  mon: bigint | null;
  amount: bigint;
};

export type PayCheck = {
  action: PayAction;
  /** True when the AUSD balance is known and below the invoice amount. */
  lowAusd: boolean;
  /** True when the native balance is known and zero. */
  lowMon: boolean;
};

/** What the pay button should do next. Order: wallet, connection, network, balances (AUSD, then MON). */
export function checkPayment(input: PayInputs): PayCheck {
  const lowAusd = input.ausd !== null && input.ausd < input.amount;
  const lowMon = input.mon !== null && input.mon === 0n;
  const result = (action: PayAction): PayCheck => ({ action, lowAusd, lowMon });

  if (!input.hasProvider) return result("no_wallet");
  if (input.account === null) return result("not_connected");
  if (input.chainId !== config.chain.id) return result("wrong_chain");
  if (input.ausd === null || input.mon === null) return result("checking");
  if (lowAusd) return result("low_ausd");
  if (lowMon) return result("low_mon");
  return result("ready");
}
