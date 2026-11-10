import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { config } from "../src/config/env.js";
import { signSessionPayload, encryptToken } from "../src/utils/crypto.js";
import { AuthController } from "../src/controllers/authController.js";

describe("Backend Health and Authentication API Integration Tests", () => {
  const app = createApp();

  it("returns 200 on health check endpoints", async () => {
    const res = await request(app).get("/api/v1/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.version, "3.11.0");
    assert.equal(res.body.githubApp, "gridcraft-auth");
  });

  it("initiates GitHub OAuth and sets a secure state cookie", async () => {
    const res = await request(app).get("/api/v1/auth/github");
    assert.equal(res.status, 302);
    assert.ok(res.header.location.startsWith("https://github.com/login/oauth/authorize"));
    assert.ok(res.header.location.includes("client_id="));
    assert.ok(res.header.location.includes("state="));

    // Verify state cookie is set with HttpOnly and Lax
    const setCookie = res.header["set-cookie"];
    assert.ok(Array.isArray(setCookie) && setCookie.length > 0);
    const stateCookie = setCookie.find((c) => c.startsWith(`${config.session.stateCookieName}=`));
    assert.ok(stateCookie);
    assert.match(stateCookie, /HttpOnly/i);
    assert.match(stateCookie, /SameSite=Lax/i);
  });

  it("initiates GitHub OAuth with JSON format when requested", async () => {
    const res = await request(app)
      .get("/api/v1/auth/github?format=json")
      .set("Accept", "application/json");

    assert.equal(res.status, 200);
    assert.ok(res.body.url.startsWith("https://github.com/login/oauth/authorize"));
    assert.equal(typeof res.body.state, "string");
  });

  it("rejects callback with 400 when OAuth state is missing", async () => {
    const res = await request(app)
      .get("/api/v1/auth/github/callback?code=mock_code&state=fake_state")
      .set("Accept", "application/json");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_STATE");
  });

  it("rejects callback with 400 when OAuth state does not match cookie", async () => {
    const res = await request(app)
      .get("/api/v1/auth/github/callback?code=mock_code&state=mismatched_state")
      .set("Cookie", [`${config.session.stateCookieName}=expected_state`])
      .set("Accept", "application/json");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_STATE");
  });

  it("handles OAuth cancellation error from GitHub", async () => {
    const res = await request(app)
      .get("/api/v1/auth/github/callback?error=access_denied&error_description=The+user+has+denied+your+application")
      .set("Accept", "application/json");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "OAUTH_DENIED");
  });

  it("rejects callback when authorization code is missing", async () => {
    const validState = "valid_state_1234567890";
    const res = await request(app)
      .get(`/api/v1/auth/github/callback?state=${validState}`)
      .set("Cookie", [`${config.session.stateCookieName}=${validState}`])
      .set("Accept", "application/json");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "MISSING_CODE");
  });

  it("completes GitHub OAuth callback and sets session cookie with mock service", async () => {
    const validState = "valid_oauth_state_secure";
    const mockService = {
      getAuthorizationUrl: () => "https://github.com/mock",
      exchangeCodeForToken: async (code) => {
        assert.equal(code, "test_valid_auth_code");
        return { accessToken: "ghu_mock_user_token_12345" };
      },
      fetchUserProfile: async (token) => {
        assert.equal(token, "ghu_mock_user_token_12345");
        return {
          id: 42,
          login: "pixelcrafter",
          name: "Pixel Crafter",
          avatarUrl: "https://avatars.githubusercontent.com/u/42",
          htmlUrl: "https://github.com/pixelcrafter",
        };
      },
      revokeToken: async () => true,
    };

    const customApp = createApp({ authService: mockService });

    const res = await request(customApp)
      .get(`/api/v1/auth/github/callback?code=test_valid_auth_code&state=${validState}`)
      .set("Cookie", [`${config.session.stateCookieName}=${validState}`]);

    assert.equal(res.status, 302);
    assert.ok(res.header.location.includes("auth_success=1"));

    // Verify session cookie was set
    const setCookie = res.header["set-cookie"];
    assert.ok(Array.isArray(setCookie));
    const sessionCookie = setCookie.find((c) => c.startsWith(`${config.session.cookieName}=`));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
  });

  it("returns unauthenticated for GET /api/v1/auth/me when no session cookie is provided", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, false);
    assert.equal(res.body.user, null);
  });

  it("returns user profile for GET /api/v1/auth/me when valid signed session cookie is provided", async () => {
    const userPayload = {
      id: 99,
      login: "artisan",
      name: "Master Artisan",
      avatarUrl: "https://github.com/artisan.png",
      htmlUrl: "https://github.com/artisan",
    };

    const encryptedToken = encryptToken("ghu_dummy_token", config.session.encryptionKey);
    const sessionData = {
      user: userPayload,
      encryptedToken,
      createdAt: Date.now(),
    };

    const signedCookie = signSessionPayload(sessionData, config.session.secret);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`${config.session.cookieName}=${signedCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, true);
    assert.deepEqual(res.body.user, userPayload);
  });

  it("POST /api/v1/auth/logout clears the session cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const setCookie = res.header["set-cookie"];
    assert.ok(Array.isArray(setCookie));
    const sessionCookie = setCookie.find((c) => c.startsWith(`${config.session.cookieName}=`));
    assert.ok(sessionCookie);
    // Expired or empty value
    assert.ok(sessionCookie.includes(`${config.session.cookieName}=;`) || sessionCookie.includes("Expires="));
  });

  it("enforces authentication on protected routes (requireAuth)", async () => {
    // Unauthenticated request should return 401
    const unauthRes = await request(app).post("/api/v1/auth/disconnect");
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.body.error.code, "UNAUTHORIZED");

    // Authenticated request
    const userPayload = { id: 1, login: "testuser" };
    const signedCookie = signSessionPayload(
      { user: userPayload, encryptedToken: "", createdAt: Date.now() },
      config.session.secret
    );

    const authRes = await request(app)
      .post("/api/v1/auth/disconnect")
      .set("Cookie", [`${config.session.cookieName}=${signedCookie}`]);

    assert.equal(authRes.status, 200);
    assert.equal(authRes.body.success, true);
  });
});
