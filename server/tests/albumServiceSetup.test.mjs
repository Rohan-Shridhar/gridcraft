import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { AlbumService } from "../src/services/albumService.js";

const ACCESS_TOKEN = "setup-test-access-token";
const user = { id: 81, login: "setup-artist", name: "Setup Artist" };

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function assertSafeStageError(error, { stage, method, path, status, code }) {
  assert.equal(error.stage, stage);
  assert.equal(error.githubMethod, method);
  assert.equal(error.githubPath, path);
  assert.equal(error.githubStatus, status);
  assert.equal(error.code, code);
  assert.equal(error.installUrl, `https://github.com/apps/${config.github.appSlug}/installations/new`);
  assert.ok(!JSON.stringify({
    message: error.message,
    userMessage: error.userMessage,
    stage: error.stage,
    method: error.githubMethod,
    path: error.githubPath,
    status: error.githubStatus,
    code: error.code,
    githubData: error.githubData,
  }).includes(ACCESS_TOKEN));
  assert.ok(!error.githubPath.includes("?"));
}

describe("Artwork library setup errors", () => {
  it("maps a repository GET 403 to APP_NOT_INSTALLED with safe request diagnostics", async () => {
    const service = new AlbumService(
      async () => response({ message: "Resource not accessible by integration" }, 403),
      {}
    );

    await assert.rejects(
      () => service.initializeExistingRepo(ACCESS_TOKEN, user),
      (error) => {
        assert.equal(error.status, 403);
        assertSafeStageError(error, {
          stage: "repo_get",
          method: "GET",
          path: "/repos/setup-artist/gridcraft-artworks",
          status: 403,
          code: "APP_NOT_INSTALLED",
        });
        return true;
      }
    );
  });

  it("maps repository creation 403 to LIBRARY_SETUP_REQUIRED and preserves its stage", async () => {
    const service = new AlbumService(
      async (url, options = {}) => {
        if (new URL(url).pathname === "/user/repos" && options.method === "POST") {
          return response({ message: "Resource not accessible by integration" }, 403);
        }
        return response({ message: "Not Found" }, 404);
      },
      {}
    );

    await assert.rejects(
      () => service.initializeExistingRepo(ACCESS_TOKEN, user),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(
          error.userMessage,
          "Create a public repository named gridcraft-artworks (with a README) on your GitHub account, then install the gridcraft-auth GitHub App on it."
        );
        assertSafeStageError(error, {
          stage: "repo_create",
          method: "POST",
          path: "/user/repos",
          status: 403,
          code: "LIBRARY_SETUP_REQUIRED",
        });
        return true;
      }
    );
  });

  it("maps catalog PUT 403 to APP_PERMISSION_DENIED with a query-free path", async () => {
    const service = new AlbumService(
      async (url, options = {}) => {
        const path = new URL(url).pathname;
        if (path === "/repos/setup-artist/gridcraft-artworks") {
          return response({ private: false, default_branch: "main" });
        }
        if (path.endsWith("/.gridcraft/catalog.json") && options.method === "PUT") {
          return response({ message: "Resource not accessible by integration" }, 403);
        }
        return response({ message: "Not Found" }, 404);
      },
      {}
    );

    await assert.rejects(
      () => service.initializeExistingRepo(ACCESS_TOKEN, user),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(
          error.userMessage,
          "gridcraft-auth needs Contents: Read and write on gridcraft-artworks. Accept any pending permission update."
        );
        assertSafeStageError(error, {
          stage: "catalog_put",
          method: "PUT",
          path: "/repos/setup-artist/gridcraft-artworks/contents/.gridcraft/catalog.json",
          status: 403,
          code: "APP_PERMISSION_DENIED",
        });
        return true;
      }
    );
  });

  it("returns setup code, user message, and install URL to API clients", () => {
    const error = new Error("GitHub denied access");
    error.status = 403;
    error.code = "APP_NOT_INSTALLED";
    error.userMessage = "Install the App on the repository.";
    error.installUrl = "https://github.com/apps/gridcraft-auth/installations/new";
    let responseBody;
    let statusCode;
    const res = {
      status(status) {
        statusCode = status;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    errorHandler(error, { method: "GET", path: "/api/v1/albums" }, res, assert.fail);

    assert.equal(statusCode, 403);
    assert.deepEqual(responseBody, {
      error: {
        code: "APP_NOT_INSTALLED",
        message: "Install the App on the repository.",
        installUrl: "https://github.com/apps/gridcraft-auth/installations/new",
      },
    });
  });
});
