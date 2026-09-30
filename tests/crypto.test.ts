import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, signPayload, verifyPassword, verifyPayload } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips and produces distinct ciphertexts", () => {
    const a = encryptSecret("EAAB-page-token");
    const b = encryptSecret("EAAB-page-token");
    expect(a).not.toEqual(b);
    expect(decryptSecret(a)).toBe("EAAB-page-token");
  });

  it("rejects tampered ciphertext", () => {
    const parts = encryptSecret("secret").split(".");
    parts[4] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("decrypts with the previous key after rotation", () => {
    const old = process.env.TOKEN_ENCRYPTION_KEY!;
    const enc = encryptSecret("rotate-me");
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = old;
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    try {
      expect(decryptSecret(enc)).toBe("rotate-me");
    } finally {
      process.env.TOKEN_ENCRYPTION_KEY = old;
      delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
    }
  });
});

describe("passwords", () => {
  it("verifies correct and rejects wrong passwords", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("signed payloads", () => {
  it("verifies and rejects tampering", () => {
    const token = signPayload("s3cret", { w: "ws1", n: "abc" });
    expect(verifyPayload("s3cret", token)).toEqual({ w: "ws1", n: "abc" });
    expect(verifyPayload("other", token)).toBeNull();
    expect(verifyPayload("s3cret", token.replace(/^./, "x"))).toBeNull();
  });
});
