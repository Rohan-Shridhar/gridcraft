import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRandomState,
  encryptToken,
  decryptToken,
  signSessionPayload,
  verifySessionPayload,
} from "../src/utils/crypto.js";

describe("Crypto and Session Utility Tests", () => {
  const secretKey = "test-secret-key-for-unit-testing-32-chars";

  it("generates distinct random states with required length", () => {
    const state1 = generateRandomState(32);
    const state2 = generateRandomState(32);

    assert.equal(typeof state1, "string");
    assert.equal(state1.length, 64); // 32 bytes = 64 hex characters
    assert.notEqual(state1, state2);
  });

  it("encrypts and decrypts access tokens accurately", () => {
    const rawToken = "ghu_16CharSampleGitHubUserAccessToken99";
    const encrypted = encryptToken(rawToken, secretKey);

    assert.notEqual(encrypted, rawToken);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    const decrypted = decryptToken(encrypted, secretKey);
    assert.equal(decrypted, rawToken);
  });

  it("fails decryption when ciphertext is tampered", () => {
    const rawToken = "ghu_sensitiveToken";
    const encrypted = encryptToken(rawToken, secretKey);
    const tampered = encrypted.slice(0, -4) + "0000";

    assert.throws(() => {
      decryptToken(tampered, secretKey);
    });
  });

  it("signs session payload and validates authentic signatures", () => {
    const payload = {
      user: { id: 12345, login: "pixelartist", name: "Pixel Artist" },
      createdAt: Date.now(),
    };

    const signed = signSessionPayload(payload, secretKey);
    assert.equal(typeof signed, "string");

    const verified = verifySessionPayload(signed, secretKey);
    assert.deepEqual(verified.user, payload.user);
    assert.equal(verified.createdAt, payload.createdAt);
  });

  it("rejects tampered or forged session payloads", () => {
    const payload = { user: { id: 1, login: "admin" }, createdAt: Date.now() };
    const signed = signSessionPayload(payload, secretKey);

    // Tamper with payload portion
    const parts = signed.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ user: { id: 2, login: "attacker" }, createdAt: Date.now() })
    ).toString("base64url");
    const tamperedSigned = `${tamperedPayload}.${parts[1]}`;

    const verified = verifySessionPayload(tamperedSigned, secretKey);
    assert.equal(verified, null);

    // Tamper with signature
    const verifiedWrongSig = verifySessionPayload(`${parts[0]}.invalidsignature`, secretKey);
    assert.equal(verifiedWrongSig, null);
  });
});
