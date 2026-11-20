import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { githubError, githubRequest, parseRetryAfterMs } from "../src/utils/githubClient.js";

describe("GitHub client utilities", () => {
  it("preserves explicit RATE_LIMITED code on 403 rate-limit responses", async () => {
    const rateLimited = githubError({ message: "API rate limit exceeded" }, 403, "RATE_LIMITED");
    assert.equal(rateLimited.status, 403);
    assert.equal(rateLimited.code, "RATE_LIMITED");

    const fetchFn = async () =>
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-remaining": "0",
        },
      });

    await assert.rejects(
      githubRequest(fetchFn, "/repos/owner/repo", "token", { retry: false }),
      (error) => error.status === 403 && error.code === "RATE_LIMITED"
    );
  });

  it("parses numeric and HTTP-date Retry-After headers and falls back on invalid values", () => {
    const now = Date.parse("2026-11-21T00:00:00.000Z");
    assert.equal(parseRetryAfterMs("3", 1000, now), 3000);
    assert.equal(parseRetryAfterMs("0", 1000, now), 0);
    assert.equal(parseRetryAfterMs("Sat, 21 Nov 2026 00:00:05 GMT", 1000, now), 5000);
    assert.equal(parseRetryAfterMs("Sat, 21 Nov 2026 00:00:00 GMT", 1000, now), 0);
    assert.equal(parseRetryAfterMs("invalid-header", 1000, now), 1000);
    assert.equal(parseRetryAfterMs("-5", 1000, now), 1000);
    assert.equal(parseRetryAfterMs(null, 1000, now), 1000);
  });
});
