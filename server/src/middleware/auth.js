import { config } from "../config/env.js";
import { verifySessionPayload, decryptToken } from "../utils/crypto.js";

export function loadSession(req, res, next) {
  const sessionCookie = req.cookies?.[config.session.cookieName];

  if (!sessionCookie) {
    req.session = null;
    req.user = null;
    return next();
  }

  const payload = verifySessionPayload(sessionCookie, config.session.secret);
  if (!payload || !payload.user || !payload.createdAt) {
    req.session = null;
    req.user = null;
    // Clear corrupted/tampered cookie
    res.clearCookie(config.session.cookieName, { path: "/" });
    return next();
  }

  // Check expiration
  if (Date.now() - payload.createdAt > config.session.maxAgeMs) {
    req.session = null;
    req.user = null;
    res.clearCookie(config.session.cookieName, { path: "/" });
    return next();
  }

  req.session = payload;
  req.user = payload.user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.session || !req.user) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "You must be signed in to access this resource.",
      },
    });
  }
  next();
}

export function getSessionAccessToken(req) {
  if (!req.session?.encryptedToken) return null;
  try {
    return decryptToken(req.session.encryptedToken, config.session.encryptionKey);
  } catch (err) {
    console.error("Failed to decrypt session token:", err.message);
    return null;
  }
}
