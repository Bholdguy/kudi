import { createSecp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { getPasskeyPrfOutput } from "@category-labs/mera";
import type { Address, Hash } from "viem";
import { readArcNonce, sendArcRawTransaction } from "@/lib/arcChain";
import { NETWORKS } from "@/lib/chains";
import { config } from "@/lib/config";
import { childPrivateKeyFromPrf } from "@/lib/passkey";
import { withSecretBytes } from "@/lib/secretBytes";

export type SendCredential = { credentialId: string; transports: readonly string[] };

export type SendParams = {
  credential: SendCredential;
  /** Index of the receiving address the funds come from. */
  index: number;
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

/**
 * A send that did not reach the network. `passkey` means the user cancelled or
 * the passkey failed (nothing was signed). `network` covers RPC errors and any
 * failure after the signature. `mismatch` means the unlocked key is not the
 * from-address, so nothing was sent.
 */
export class ArcSendError extends Error {
  readonly reason: "passkey" | "network" | "mismatch";
  readonly cause: unknown;

  constructor(reason: "passkey" | "network" | "mismatch", cause?: unknown) {
    super(reason);
    this.name = "ArcSendError";
    this.reason = reason;
    this.cause = cause;
  }
}

/**
 * Sends a native USDC transfer from one receiving address. The passkey prompt
 * comes first, so the caller must start this straight from the Confirm tap.
 *
 * Key handling: the PRF secret and the child private key each live only inside
 * a `withSecretBytes` scope and are zeroed when it ends, on success or error.
 * The signing session is ended in `finally`. Nothing here is stored, logged or
 * returned, except the transaction hash.
 */
export function sendArcUsdc(params: SendParams): Promise<Hash> {
  return withSecretBytes(
    () => acquirePrf(params.credential),
    (prf) => withSecretBytes(
      () => childPrivateKeyFromPrf(prf, params.index),
      (childKey) => signAndBroadcast(childKey, params),
    ),
  );
}

/** Asks for the passkey. Its PRF output is the caller's to wipe. */
async function acquirePrf(credential: SendCredential): Promise<Uint8Array> {
  try {
    const asserted = await getPasskeyPrfOutput({
      rpId: config.passkeyRpId,
      credential: { credentialId: credential.credentialId, transports: [...credential.transports] },
    });
    return asserted.prfOutput;
  } catch (error) {
    throw new ArcSendError("passkey", error);
  }
}

async function signAndBroadcast(childKey: Uint8Array, params: SendParams): Promise<Hash> {
  const session = createSecp256k1SigningSession({ privateKey: childKey });
  try {
    const account = toViemAccount(session);
    if (account.address.toLowerCase() !== params.from.toLowerCase()) {
      throw new ArcSendError("mismatch");
    }
    const nonce = await readArcNonce(params.from);
    const serializedTransaction = await account.signTransaction({
      type: "eip1559",
      chainId: NETWORKS.arc.chain.id,
      to: params.to,
      value: params.value,
      nonce,
      gas: params.gas,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    });
    return await sendArcRawTransaction(serializedTransaction);
  } catch (error) {
    if (error instanceof ArcSendError) throw error;
    throw new ArcSendError("network", error);
  } finally {
    session.end();
  }
}
