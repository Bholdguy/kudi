import {
  createPasskeyWithPrfOutput,
  getEvmAddress,
  getPasskeyPrfOutput,
  isMeraError,
} from "@category-labs/mera";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { config } from "@/lib/config";

// BIP-44 on coin type 60. The last level (address index) is not hardened, so
// public addresses for any index derive from the account-level public key.
const ACCOUNT_PATH = "m/44'/60'/0'/0";

export type AccountPublicData = {
  accountXpub: string;
  homeAddress: string;
};

export type PasskeyAccount = AccountPublicData & {
  credentialId: string;
  transports: string[];
};

export type StoredCredential = {
  credentialId: string;
  transports: readonly string[];
};

export type PasskeyErrorKind =
  | "prf_unavailable"
  | "cancelled"
  | "insecure"
  | "unknown";

export type PasskeyAction = "signUp" | "signIn";

/** Address for `index`, derived from the public account key. No passkey needed. */
export function addressAt(accountXpub: string, index: number): string {
  const publicKey = HDKey.fromExtendedKey(accountXpub).deriveChild(index).publicKey;
  if (!publicKey) {
    throw new Error("Public key derivation failed");
  }
  return getEvmAddress(publicKey);
}

/**
 * Turns a passkey's 32 secret bytes into the account-level public key and the
 * home address (index 0). All private material created here is zeroed before
 * returning. The caller still owns, and must zero, `prfOutput`.
 */
export function accountFromPrfOutput(prfOutput: Uint8Array): AccountPublicData {
  const mnemonic = entropyToMnemonic(prfOutput, wordlist);
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(ACCOUNT_PATH);
  try {
    const accountXpub = account.publicExtendedKey;
    return { accountXpub, homeAddress: addressAt(accountXpub, 0) };
  } finally {
    account.wipePrivateData();
    root.wipePrivateData();
    seed.fill(0);
  }
}

export async function createAccount(): Promise<PasskeyAccount> {
  const label = `${config.appName} account ${new Date().toLocaleDateString()}`;
  const created = await createPasskeyWithPrfOutput({
    rp: { id: config.passkeyRpId, name: config.appName },
    user: { name: label, displayName: label },
  });
  try {
    return {
      credentialId: created.credentialId,
      transports: [...(created.transports ?? [])],
      ...accountFromPrfOutput(created.prfOutput),
    };
  } finally {
    created.prfOutput.fill(0);
  }
}

/** Unlocks with the stored passkey, or lets the user pick one when none is stored. */
export async function signInWithPasskey(
  stored: StoredCredential | null,
): Promise<PasskeyAccount> {
  const asserted = await getPasskeyPrfOutput({
    rpId: config.passkeyRpId,
    ...(stored
      ? {
          credential: {
            credentialId: stored.credentialId,
            transports: [...stored.transports],
          },
        }
      : {}),
  });
  try {
    return {
      credentialId: asserted.credentialId,
      transports: stored?.credentialId === asserted.credentialId ? [...stored.transports] : [],
      ...accountFromPrfOutput(asserted.prfOutput),
    };
  } finally {
    asserted.prfOutput.fill(0);
  }
}

export function classifyPasskeyError(error: unknown): PasskeyErrorKind {
  if (!isMeraError(error)) return "unknown";
  switch (error.code) {
    case "PRF_UNAVAILABLE":
      return "prf_unavailable";
    case "PASSKEY_OPERATION_FAILED":
      return "cancelled";
    case "CRYPTO_UNAVAILABLE":
      return "insecure";
    default:
      return "unknown";
  }
}

export function passkeyErrorMessage(kind: PasskeyErrorKind, action: PasskeyAction): string {
  switch (kind) {
    case "prf_unavailable":
      return "This browser can't create a Kudi account. Try Safari on iPhone, or Chrome with Google Password Manager.";
    case "cancelled":
      return action === "signUp"
        ? "Sign-up cancelled. Tap to try again."
        : "Sign-in cancelled. Tap to try again.";
    case "insecure":
      return "Kudi needs a secure connection. Open the https:// address and try again.";
    case "unknown":
      return "Something went wrong. Tap to try again.";
  }
}
