import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  githubError,
  githubRequest,
  parseLinkHeader,
  parseRetryAfterMs,
  resolveBranch,
  resolveLibraryBranch,
} from "../src/utils/githubClient.js";

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

  it("handles non-string Link headers, non-string error messages, whitespace branches, and null library responses", async () => {
    assert.deepEqual(parseLinkHeader(null), {});
    assert.deepEqual(parseLinkHeader(["<https://api.github.com/items?page=2>; rel=\"next\""]), {});
    assert.deepEqual(
      parseLinkHeader("<https://api.github.com/items?page=2>; rel=\"next\""),
      { next: "https://api.github.com/items?page=2" }
    );

    const malformed = githubError({ message: { nested: true } }, 403);
    assert.equal(malformed.message, "GitHub API request failed with status 403");
    assert.equal(malformed.userMessage, "GitHub denied this action. Check repository permissions.");

    const blankMessage = githubError({ message: "   " }, 429, "RATE_LIMITED");
    assert.equal(blankMessage.message, "GitHub API request failed with status 429");
    assert.equal(blankMessage.userMessage, "GitHub API rate limit exceeded. Please try again later.");

    assert.equal(resolveBranch(null), undefined);
    assert.equal(resolveBranch({ query: { branch: "   " }, body: { branch: "  feature  " } }), "feature");
    assert.equal(resolveBranch({ query: { branch: "   " }, body: { branch: "   " } }), undefined);

    const nullBodyFetch = async () => new Response("not-json", { status: 200 });
    const resolved = await resolveLibraryBranch(nullBodyFetch, "token", "owner", "master");
    assert.equal(resolved, "master");
  });
});
