import crypto from "node:crypto";
import { config } from "../config/env.js";
import { generateRandomState, encryptToken, signSessionPayload } from "../utils/crypto.js";
import { githubAuthService } from "../services/githubAuthService.js";
import { albumService } from "../services/albumService.js";
import { getSessionAccessToken } from "../middleware/auth.js";

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
  };
}

function frontendBaseUrl() {
  return String(config.frontendUrl || "").replace(/\/+$/, "");
}

function frontendHost() {
  const frontendUrl = frontendBaseUrl();
  try {
    return new URL(frontendUrl).host;
  } catch {
    return frontendUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
  }
}

function statesMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" || !received || !expected) {
    return false;
  }
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class AuthController {
  constructor(service = githubAuthService, libraryService = albumService) {
    this.service = service;
    this.libraryService = libraryService;
  }

  startGitHubAuth = (req, res) => {
    const state = generateRandomState(32);

    res.cookie(config.session.stateCookieName, state, {
      ...authCookieOptions(),
      maxAge: config.session.stateMaxAgeMs,
    });

    const authUrl = this.service.getAuthorizationUrl(state);

    // If client requested JSON (API check/test), return URL
    if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
      return res.json({ url: authUrl, state });
    }

    return res.redirect(authUrl);
  };

  handleGitHubCallback = async (req, res, next) => {
    const { code, state, error, error_description } = req.query;
    const storedState = req.cookies?.[config.session.stateCookieName];
    const frontendUrl = frontendBaseUrl();

    // Always clear the temporary OAuth state cookie
    res.clearCookie(config.session.stateCookieName, authCookieOptions());

    const wantsJson = req.headers.accept?.includes("application/json");

    // 1. Check if GitHub returned an OAuth authorization error
    if (error) {
      const msg =
        typeof error_description === "string" && error_description
          ? error_description
          : typeof error === "string"
            ? error
            : "OAuth authorization failed.";
      if (wantsJson) {
        return res.status(400).json({ error: { code: "OAUTH_DENIED", message: msg } });
      }
      return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    // 2. Validate state against stored state cookie (CSRF prevention)
    if (!statesMatch(state, storedState)) {
      const cookiePresent = storedState !== undefined;
      console.warn(
        "[OAUTH_STATE_FAILURE]",
        JSON.stringify({
          cookiePresent,
          hostname: req.hostname,
          protocol: req.protocol,
          xForwardedProto: req.get("x-forwarded-proto") || null,
          statePresent: state !== undefined,
        })
      );

      const code = cookiePresent ? "INVALID_STATE" : "STATE_COOKIE_MISSING";
      const msg = cookiePresent
        ? "Invalid or expired OAuth state. Please try signing in again."
        : `Sign-in session cookie was not received. Start sign-in from ${frontendHost()} in a fresh tab and make sure cookies are enabled.`;
      if (wantsJson) {
        return res.status(400).json({ error: { code, message: msg } });
      }
      return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    // 3. Ensure authorization code is present
    if (typeof code !== "string" || !code) {
      const msg = "Missing authorization code from GitHub.";
      if (wantsJson) {
        return res.status(400).json({ error: { code: "MISSING_CODE", message: msg } });
      }
      return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    let tokenData;
    let user;
    try {
      // 4. Exchange code for user access token
      tokenData = await this.service.exchangeCodeForToken(code);

      // 5. Fetch user profile from GitHub
      user = await this.service.fetchUserProfile(tokenData.accessToken);
    } catch (err) {
      console.error("[AUTH_CALLBACK_ERROR]", err?.message || err);
      const msg = err?.message || "Failed to complete GitHub sign-in.";
      const rawStatus = err?.status;
      const status =
        Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
          ? rawStatus
          : 500;
      if (wantsJson) {
        return res.status(status).json({
          error: { code: err?.code || "AUTH_FAILED", message: msg },
        });
      }
      return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    // 6. Encrypt the token and issue the authenticated session before optional setup.
    const encryptedToken = encryptToken(
      tokenData.accessToken,
      config.session.encryptionKey
    );
    const sessionPayload = {
      user,
      encryptedToken,
      createdAt: Date.now(),
    };
    const signedSession = signSessionPayload(sessionPayload, config.session.secret);
    res.cookie(config.session.cookieName, signedSession, {
      ...authCookieOptions(),
      maxAge: config.session.maxAgeMs,
    });

    try {
      await this.libraryService.initializeExistingRepo(tokenData.accessToken, user);
    } catch (err) {
      const expectedCodes = new Set([
        "LIBRARY_SETUP_REQUIRED",
        "APP_NOT_INSTALLED",
        "APP_PERMISSION_DENIED",
      ]);
      const setupCode = expectedCodes.has(err?.code) ? err.code : "UNKNOWN";
      const safeLogValue = (value) =>
        typeof value === "string" && /^[A-Za-z0-9_]+$/.test(value) ? value : "unknown";
      const status = Number.isInteger(err?.githubStatus)
        ? err.githubStatus
        : Number.isInteger(err?.status)
          ? err.status
          : "unknown";

      console.warn(
        `[AUTH_SETUP_WARN] stage=${safeLogValue(err?.stage)} method=${safeLogValue(err?.githubMethod)} path=${typeof err?.githubPath === "string" ? err.githubPath : "unknown"} status=${status} code=${setupCode}`
      );
      return res.redirect(
        `${frontendUrl}/?auth_success=1&setup=required&setup_code=${encodeURIComponent(setupCode)}`
      );
    }

    if (wantsJson) {
      return res.json({ authenticated: true, user });
    }

    return res.redirect(`${frontendUrl}/?auth_success=1`);
  };

  getCurrentUser = (req, res) => {
    if (!req.session || !req.user) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: req.user,
    });
  };

  logout = (req, res) => {
    res.clearCookie(config.session.cookieName, authCookieOptions());
    return res.json({ success: true, message: "Logged out successfully" });
  };

  disconnect = async (req, res) => {
    const accessToken = getSessionAccessToken(req);
    res.clearCookie(config.session.cookieName, authCookieOptions());

    if (accessToken) {
      await this.service.revokeToken(accessToken).catch(() => {});
    }

    return res.json({ success: true, message: "Disconnected successfully" });
  };
}

export const authController = new AuthController();
