import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeUrl, sanitizeHeaders } from "../src/middleware/logger.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

describe("Server middleware hardening", () => {
  it("redacts duplicate and adjacent sensitive query parameters and handles null headers", () => {
    const sanitized = sanitizeUrl(
      "/api/v1/auth/github/callback?code=abc&code=def&state=xyz&refresh_token=r123&ok=1"
    );
    assert.ok(!sanitized.includes("abc"));
    assert.ok(!sanitized.includes("def"));
    assert.ok(!sanitized.includes("xyz"));
    assert.ok(!sanitized.includes("r123"));
    assert.ok(sanitized.includes("ok=1"));

    assert.deepEqual(sanitizeHeaders(null), {});
    assert.deepEqual(sanitizeHeaders({ Authorization: "Bearer secret", "X-Test": "ok" }), {
      Authorization: "[REDACTED]",
      "X-Test": "ok",
    });
  });

  it("delegates to next(err) when headers are already sent and handles invalid error shapes", () => {
    let delegated = null;
    let statusCalled = false;
    const sentErr = new Error("late failure");
    errorHandler(
      sentErr,
      { method: "GET", path: "/test" },
      {
        headersSent: true,
        status() {
          statusCalled = true;
          return this;
        },
        json() {},
      },
      (err) => {
        delegated = err;
      }
    );
    assert.equal(delegated, sentErr);
    assert.equal(statusCalled, false);

    let capturedStatus = null;
    let capturedBody = null;
    errorHandler(
      { status: 999, message: "bad status" },
      { method: "GET", path: "/test" },
      {
        headersSent: false,
        status(code) {
          capturedStatus = code;
          return this;
        },
        json(body) {
          capturedBody = body;
        },
      },
      () => {}
    );
    assert.equal(capturedStatus, 500);
    assert.equal(capturedBody.error.code, "INTERNAL_SERVER_ERROR");

    capturedStatus = null;
    capturedBody = null;
    errorHandler(
      null,
      { method: "GET", path: "/test" },
      {
        headersSent: false,
        status(code) {
          capturedStatus = code;
          return this;
        },
        json(body) {
          capturedBody = body;
        },
      },
      () => {}
    );
    assert.equal(capturedStatus, 500);
    assert.equal(capturedBody.error.code, "INTERNAL_SERVER_ERROR");
  });
});
