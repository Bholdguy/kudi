import { createSecp256k1SigningSession, getEvmAddress } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { describe, expect, it } from "vitest";
import { accountFromPrfOutput, addressAt, childPrivateKeyFromPrf } from "@/lib/passkey";

// A fixed stand-in for a passkey PRF output. No real passkey is involved.
const PRF = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);

describe("child private key from the passkey secret", () => {
  it("signs for exactly the address the app shows for that index", () => {
    const { accountXpub } = accountFromPrfOutput(PRF);
    for (const index of [0, 1, 2]) {
      const key = childPrivateKeyFromPrf(PRF, index);
      const session = createSecp256k1SigningSession({ privateKey: key });
      try {
        const account = toViemAccount(session);
        expect(account.address).toBe(addressAt(accountXpub, index));
      } finally {
        session.end();
        key.fill(0);
      }
    }
  });

  it("gives a different key for each index", () => {
    const a = childPrivateKeyFromPrf(PRF, 1);
    const b = childPrivateKeyFromPrf(PRF, 2);
    expect(Array.from(a)).not.toEqual(Array.from(b));
    a.fill(0);
    b.fill(0);
  });

  it("the public key of the derived key maps to the same address via Mera", () => {
    const { accountXpub } = accountFromPrfOutput(PRF);
    const key = childPrivateKeyFromPrf(PRF, 1);
    const session = createSecp256k1SigningSession({ privateKey: key });
    try {
      expect(getEvmAddress(session.publicKey)).toBe(addressAt(accountXpub, 1));
    } finally {
      session.end();
      key.fill(0);
    }
  });
});
