import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlbumService } from "../src/services/albumService.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Album repository metadata", () => {
  it("returns GitHub-native fork, upstream, and permission metadata", async () => {
    const service = new AlbumService(async (url) => {
      if (url.includes("/contents/.gridcraft/album.json")) {
        return response({ message: "Not Found" }, 404);
      }
      return response({
        id: 8,
        name: "album",
        full_name: "artist/album",
        owner: { login: "artist", avatar_url: "https://avatars.example/artist.png" },
        private: false,
        default_branch: "master",
        html_url: "https://github.com/artist/album",
        fork: true,
        parent: {
          name: "album",
          full_name: "creator/album",
          owner: { login: "creator" },
          default_branch: "master",
          html_url: "https://github.com/creator/album",
        },
        source: {
          name: "album",
          full_name: "creator/album",
          owner: { login: "creator" },
          default_branch: "master",
          html_url: "https://github.com/creator/album",
        },
        permissions: { push: true, pull: true },
      });
    });

    const result = await service.getAlbum("token", "artist", "album");
    assert.equal(result.repo.fork, true);
    assert.equal(result.repo.parent.fullName, "creator/album");
    assert.equal(result.repo.source.fullName, "creator/album");
    assert.deepEqual(result.repo.permissions, { push: true, pull: true });
  });
});
