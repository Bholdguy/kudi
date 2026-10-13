import { MeraError } from "@category-labs/mera";
import { describe, expect, it } from "vitest";
import { classifyPasskeyError, passkeyErrorMessage } from "@/lib/passkey";

describe("E1 / E3 the passkey provider has no PRF", () => {
  it("is recognised by the MeraError code", () => {
    const error = new MeraError("PRF_UNAVAILABLE", "Authenticator did not enable PRF");
    expect(classifyPasskeyError(error)).toBe("prf_unavailable");
  });

  it("is recognised by code even when the message says something else", () => {
    const error = new MeraError("PRF_UNAVAILABLE", "completely different wording");
    expect(classifyPasskeyError(error)).toBe("prf_unavailable");
  });

  it("is not recognised by message text alone", () => {
    expect(classifyPasskeyError(new Error("PRF_UNAVAILABLE"))).toBe("unknown");
    expect(classifyPasskeyError(new Error("Authenticator did not enable PRF"))).toBe("unknown");
  });

  it("shows the PRD copy and never the raw error text", () => {
    const message = passkeyErrorMessage("prf_unavailable", "signUp");
    expect(message).toBe(
      "This browser can't create a Kudi account. Try Safari on iPhone, or Chrome with Google Password Manager.",
    );
    expect(message).not.toContain("PRF_UNAVAILABLE");
  });
});

describe("E2 the biometric prompt is cancelled", () => {
  it("maps a failed or dismissed passkey operation to the cancelled message", () => {
    const error = new MeraError("PASSKEY_OPERATION_FAILED", "Passkey creation failed");
    expect(classifyPasskeyError(error)).toBe("cancelled");
    expect(passkeyErrorMessage("cancelled", "signUp")).toBe("Sign-up cancelled. Tap to try again.");
    expect(passkeyErrorMessage("cancelled", "signIn")).toBe("Sign-in cancelled. Tap to try again.");
  });
});

describe("other passkey failures stay plain", () => {
  it("a missing secure connection says so", () => {
    expect(classifyPasskeyError(new MeraError("CRYPTO_UNAVAILABLE", "x"))).toBe("insecure");
    expect(passkeyErrorMessage("insecure", "signIn")).toContain("secure connection");
  });

  it("anything else is a generic retry message with no technical text", () => {
    expect(classifyPasskeyError(new MeraError("INPUT_INVALID", "salt must be 32 bytes"))).toBe("unknown");
    expect(classifyPasskeyError(undefined)).toBe("unknown");
    expect(passkeyErrorMessage("unknown", "signUp")).toBe("Something went wrong. Tap to try again.");
  });
});
