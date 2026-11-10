import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from the provided secret string.
 */
function deriveKey(secret) {
  return crypto.createHash("sha256").update(String(secret || "default-secret-key-change-me")).digest();
}

/**
 * Generates a cryptographically secure random hex string for OAuth state.
 */
export function generateRandomState(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: iv:authTag:encryptedHex
 */
export function encryptToken(text, secret) {
  if (!text) return "";
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts ciphertext produced by encryptToken using AES-256-GCM.
 */
export function decryptToken(cipherText, secret) {
  if (!cipherText) return "";
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload structure");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey(secret);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Signs a session object and returns a base64 string with HMAC signature.
 */
export function signSessionPayload(data, secret) {
  const jsonStr = JSON.stringify(data);
  const base64Data = Buffer.from(jsonStr, "utf8").toString("base64url");
  const hmac = crypto
    .createHmac("sha256", deriveKey(secret))
    .update(base64Data)
    .digest("base64url");
  return `${base64Data}.${hmac}`;
}

/**
 * Verifies a signed session string and returns the parsed payload.
 * Returns null if invalid or tampered.
 */
export function verifySessionPayload(signedStr, secret) {
  if (!signedStr || typeof signedStr !== "string") return null;
  const parts = signedStr.split(".");
  if (parts.length !== 2) return null;

  const [base64Data, providedHmac] = parts;
  const expectedHmac = crypto
    .createHmac("sha256", deriveKey(secret))
    .update(base64Data)
    .digest("base64url");

  // Constant-time comparison
  const providedBuffer = Buffer.from(providedHmac);
  const expectedBuffer = Buffer.from(expectedHmac);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
