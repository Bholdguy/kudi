import { getEvmAddress } from "@category-labs/mera";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { describe, expect, it } from "vitest";
import { privateKeyToAddress } from "viem/accounts";
import { mnemonicToAccount } from "viem/accounts";
import { accountFromPrfOutput, addressAt } from "@/lib/passkey";

function prfBytes(): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => i);
}

function privateAddress(prf: Uint8Array, index: number): string {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prf, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey || !node.publicKey) throw new Error("no key");
  const fromPrivateKey = privateKeyToAddress(
    `0x${Buffer.from(node.privateKey).toString("hex")}`,
  );
  expect(getEvmAddress(node.publicKey)).toBe(fromPrivateKey);
  return fromPrivateKey;
}

describe("KUDI-01 / KUDI-02 account derivation", () => {
  it("KUDI-02: the same passkey output always gives the same home address", () => {
    const first = accountFromPrfOutput(prfBytes());
    const second = accountFromPrfOutput(prfBytes());
    expect(second.homeAddress).toBe(first.homeAddress);
    expect(second.accountXpub).toBe(first.accountXpub);
  });

  it("KUDI-02: different passkey outputs give different accounts", () => {
    const other = prfBytes();
    other[0] = 255;
    expect(accountFromPrfOutput(other).homeAddress).not.toBe(
      accountFromPrfOutput(prfBytes()).homeAddress,
    );
  });

  it("KUDI-05: xpub addresses for indexes 0 to 3 match the full private derivation", () => {
    const prf = prfBytes();
    const { accountXpub } = accountFromPrfOutput(prf);
    for (const index of [0, 1, 2, 3]) {
      expect(addressAt(accountXpub, index)).toBe(privateAddress(prf, index));
    }
  });

  it("KUDI-05: xpub addresses match an independent BIP-44 implementation (viem)", () => {
    const prf = prfBytes();
    const mnemonic = entropyToMnemonic(prf, wordlist);
    const { accountXpub } = accountFromPrfOutput(prf);
    for (const index of [0, 1, 2, 3]) {
      expect(addressAt(accountXpub, index)).toBe(
        mnemonicToAccount(mnemonic, { addressIndex: index }).address,
      );
    }
  });

  it("KUDI-05: indexes 0 to 3 give four different addresses", () => {
    const { accountXpub } = accountFromPrfOutput(prfBytes());
    const addresses = new Set([0, 1, 2, 3].map((i) => addressAt(accountXpub, i)));
    expect(addresses.size).toBe(4);
  });

  it("NFR-05: the stored account key is public only", () => {
    const { accountXpub, homeAddress } = accountFromPrfOutput(prfBytes());
    expect(accountXpub.startsWith("xpub")).toBe(true);
    expect(HDKey.fromExtendedKey(accountXpub).privateKey).toBeNull();
    expect(homeAddress).toBe(addressAt(accountXpub, 0));
  });
});
