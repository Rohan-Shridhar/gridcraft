import { config } from "../config/env.js";
import { APP_VERSION } from "../config/version.js";

export class GitHubAuthService {
  constructor(cfg = config) {
    this.config = cfg;
  }

  getAuthorizationUrl(state, redirectUri) {
    const callbackUri = redirectUri || `${this.config.backendUrl}/api/v1/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: this.config.github.clientId,
      redirect_uri: callbackUri,
      state: state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code, redirectUri) {
    const callbackUri = redirectUri || `${this.config.backendUrl}/api/v1/auth/github/callback`;
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `GridCraft/${APP_VERSION}`,
      },
      body: JSON.stringify({
        client_id: this.config.github.clientId,
        client_secret: this.config.github.clientSecret,
        code,
        redirect_uri: callbackUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      const err = new Error(data.error_description || data.error);
      err.code = data.error.toUpperCase();
      err.status = 400;
      throw err;
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async fetchUserProfile(accessToken) {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": `GridCraft/${APP_VERSION}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const err = new Error(`Failed to fetch user profile from GitHub: ${response.status}`);
      err.status = response.status === 401 ? 401 : 502;
      throw err;
    }

    const user = await response.json();
    return {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
    };
  }

  async revokeToken(accessToken) {
    if (!accessToken || !this.config.github.clientId || !this.config.github.clientSecret) {
      return false;
    }

    try {
      const auth = Buffer.from(
        `${this.config.github.clientId}:${this.config.github.clientSecret}`
      ).toString("base64");

      const response = await fetch(
        `https://api.github.com/applications/${this.config.github.clientId}/token`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/vnd.github+json",
            "User-Agent": `GridCraft/${APP_VERSION}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: accessToken }),
        }
      );

      return response.status === 204;
    } catch (err) {
      console.warn("Failed to revoke token at GitHub:", err.message);
      return false;
    }
  }
}

export const githubAuthService = new GitHubAuthService();
