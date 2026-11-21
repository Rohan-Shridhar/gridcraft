import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GitHubAuthService } from "../src/services/githubAuthService.js";

const baseConfig = {
  backendUrl: "https://api.example.com///",
  github: {
    clientId: "client-id/1",
    clientSecret: "secret-value",
  },
};

describe("GitHubAuthService", () => {
  it("normalizes trailing slashes in backendUrl when building redirect_uri", () => {
    const service = new GitHubAuthService(baseConfig);
    const url = new URL(service.getAuthorizationUrl("state-123"));

    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://api.example.com/api/v1/auth/github/callback"
    );
  });

  it("rejects token exchange responses missing access_token and handles non-string error codes", async () => {
    const emptyTokenService = new GitHubAuthService(
      baseConfig,
      async () => new Response(JSON.stringify({ token_type: "bearer" }), { status: 200 })
    );
    await assert.rejects(
      () => emptyTokenService.exchangeCodeForToken("code-1"),
      (err) => err.status === 502 && /no access token/i.test(err.message)
    );

    const nonStringErrorService = new GitHubAuthService(
      baseConfig,
      async () => new Response(JSON.stringify({ error: 123, error_description: "Bad code" }), { status: 200 })
    );
    await assert.rejects(
      () => nonStringErrorService.exchangeCodeForToken("code-2"),
      (err) => err.status === 400 && err.code === "OAUTH_ERROR" && err.message === "Bad code"
    );
  });

  it("rejects malformed user profile responses and URL-encodes clientId on token revocation", async () => {
    const badProfileService = new GitHubAuthService(
      baseConfig,
      async () => new Response(JSON.stringify({ name: "No Login" }), { status: 200 })
    );
    await assert.rejects(
      () => badProfileService.fetchUserProfile("token-1"),
      (err) => err.status === 502 && /missing required fields/i.test(err.message)
    );

    const requestedUrls = [];
    const revokeService = new GitHubAuthService(baseConfig, async (url) => {
      requestedUrls.push(url);
      return new Response(null, { status: 204 });
    });
    const revoked = await revokeService.revokeToken("token-1");
    assert.equal(revoked, true);
    assert.equal(
      requestedUrls[0],
      "https://api.github.com/applications/client-id%2F1/token"
    );
  });
});
