import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { request } from "./apiClient.js";

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
