import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForkService } from "../src/services/forkService.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHub fork operations", () => {
  it("creates a native GitHub fork and returns its upstream relationship", async () => {
    let requestUrl;
    let requestMethod;
    const service = new ForkService(async (url, options) => {
      requestUrl = new URL(url);
      requestMethod = options.method;
      return response({
        name: "pixel-album",
        full_name: "artist/pixel-album",
        html_url: "https://github.com/artist/pixel-album",
        fork: true,
        private: false,
        owner: { login: "artist" },
        parent: {
          name: "pixel-album",
          full_name: "creator/pixel-album",
          owner: { login: "creator" },
          default_branch: "master",
        },
        source: {
          name: "pixel-album",
          full_name: "creator/pixel-album",
          owner: { login: "creator" },
        },
      }, 202);
    });

    const result = await service.forkAlbum("token", "creator", "pixel-album");
    assert.equal(requestUrl.pathname, "/repos/creator/pixel-album/forks");
    assert.equal(requestMethod, "POST");
    assert.equal(result.repo.fullName, "artist/pixel-album");
    assert.equal(result.repo.fork, true);
    assert.equal(result.repo.parent.fullName, "creator/pixel-album");
    assert.equal(result.repo.source.fullName, "creator/pixel-album");
  });
});
