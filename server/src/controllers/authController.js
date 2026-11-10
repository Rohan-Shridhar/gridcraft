import { config } from "../config/env.js";
import { generateRandomState, encryptToken, signSessionPayload } from "../utils/crypto.js";
import { githubAuthService } from "../services/githubAuthService.js";
import { getSessionAccessToken } from "../middleware/auth.js";

export class AuthController {
  constructor(service = githubAuthService) {
    this.service = service;
  }

  startGitHubAuth = (req, res) => {
    const state = generateRandomState(32);

    res.cookie(config.session.stateCookieName, state, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/",
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

    // Always clear the temporary OAuth state cookie
    res.clearCookie(config.session.stateCookieName, { path: "/" });

    const wantsJson = req.headers.accept?.includes("application/json");

    // 1. Check if GitHub returned an OAuth authorization error
    if (error) {
      const msg = error_description || error;
      if (wantsJson) {
        return res.status(400).json({ error: { code: "OAUTH_DENIED", message: msg } });
      }
      return res.redirect(`${config.frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    // 2. Validate state against stored state cookie (CSRF prevention)
    if (!state || !storedState || state !== storedState) {
      const msg = "Invalid or expired OAuth state. Please try signing in again.";
      if (wantsJson) {
        return res.status(400).json({ error: { code: "INVALID_STATE", message: msg } });
      }
      return res.redirect(`${config.frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    // 3. Ensure authorization code is present
    if (!code) {
      const msg = "Missing authorization code from GitHub.";
      if (wantsJson) {
        return res.status(400).json({ error: { code: "MISSING_CODE", message: msg } });
      }
      return res.redirect(`${config.frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }

    try {
      // 4. Exchange code for user access token
      const tokenData = await this.service.exchangeCodeForToken(code);

      // 5. Fetch user profile from GitHub
      const user = await this.service.fetchUserProfile(tokenData.accessToken);

      // 6. Encrypt access token at rest for session storage
      const encryptedToken = encryptToken(
        tokenData.accessToken,
        config.session.encryptionKey
      );

      // 7. Sign session payload
      const sessionPayload = {
        user,
        encryptedToken,
        createdAt: Date.now(),
      };

      const signedSession = signSessionPayload(sessionPayload, config.session.secret);

      // 8. Set HttpOnly session cookie
      res.cookie(config.session.cookieName, signedSession, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: config.session.maxAgeMs,
      });

      if (wantsJson) {
        return res.json({ authenticated: true, user });
      }

      return res.redirect(`${config.frontendUrl}/?auth_success=1`);
    } catch (err) {
      console.error("[AUTH_CALLBACK_ERROR]", err.message || err);
      const msg = err.message || "Failed to complete GitHub sign-in.";
      if (wantsJson) {
        return res.status(err.status || 500).json({
          error: { code: err.code || "AUTH_FAILED", message: msg },
        });
      }
      return res.redirect(`${config.frontendUrl}/?auth_error=${encodeURIComponent(msg)}`);
    }
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
    res.clearCookie(config.session.cookieName, { path: "/" });
    return res.json({ success: true, message: "Logged out successfully" });
  };

  disconnect = async (req, res) => {
    const accessToken = getSessionAccessToken(req);
    res.clearCookie(config.session.cookieName, { path: "/" });

    if (accessToken) {
      await this.service.revokeToken(accessToken).catch(() => {});
    }

    return res.json({ success: true, message: "Disconnected successfully" });
  };
}

export const authController = new AuthController();
