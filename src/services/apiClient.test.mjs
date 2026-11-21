import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { apiClient, request } from "./apiClient.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it("preserves default Accept and Content-Type headers when custom headers are passed", async () => {
  let capturedConfig;
  globalThis.fetch = async (_url, config) => {
    capturedConfig = config;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await request("/api/v1/test", {
    method: "POST",
    body: { hello: "world" },
    headers: { "X-Custom": "1" },
  });

  assert.equal(capturedConfig.headers.Accept, "application/json");
  assert.equal(capturedConfig.headers["Content-Type"], "application/json");
  assert.equal(capturedConfig.headers["X-Custom"], "1");
  assert.equal(capturedConfig.credentials, "include");
});

it("allows custom headers to override default headers without dropping others", async () => {
  let capturedConfig;
  globalThis.fetch = async (_url, config) => {
    capturedConfig = config;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await request("/api/v1/test", {
    method: "POST",
    body: { hello: "world" },
    headers: { Accept: "text/plain" },
  });

  assert.equal(capturedConfig.headers.Accept, "text/plain");
  assert.equal(capturedConfig.headers["Content-Type"], "application/json");
});

it("handles null options, mixed-case JSON content-type, non-string error messages, and encodes issue/pull numbers", async () => {
  const capturedUrls = [];
  globalThis.fetch = async (url) => {
    capturedUrls.push(url);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "Application/JSON; charset=utf-8" },
    });
  };

  const data = await request("/api/v1/test", null);
  assert.deepEqual(data, { ok: true });

  await apiClient.getIssue("owner", "repo", "1/2", 2);
  await apiClient.getPull("owner", "repo", "3#4", 1);
  await apiClient.listIssues("owner", "repo", null);
  await apiClient.listPulls("owner", "repo", null);
  assert.equal(capturedUrls[1], "/api/v1/albums/owner/repo/issues/1%2F2?page=2");
  assert.equal(capturedUrls[2], "/api/v1/albums/owner/repo/pulls/3%234?page=1");

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "   ", code: 500 } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    request("/api/v1/fail"),
    (err) => err.message === "Request failed with status 500" && err.code === "REQUEST_FAILED"
  );
});
