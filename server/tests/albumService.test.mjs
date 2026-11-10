import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlbumService } from "../src/services/albumService.js";
import { AppStore } from "../src/services/appStore.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Album folder metadata", () => {
  it("reads a GridCraft album manifest from the owner's shared artwork library", async () => {
    const user = { id: 8, login: "artist", name: "Artist" };
    const store = new AppStore(":memory:");
    store.createAlbum(user, { slug: "forest", name: "Forest" });
    const manifest = {
      format: "gridcraft-album",
      schemaVersion: 1,
      id: "forest",
      name: "Forest",
      description: "Woodland sprites",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdWith: { name: "GridCraft", version: "4.0.0" },
    };
    const requests = [];
    const service = new AlbumService(async (url) => {
      const requestUrl = new URL(url);
      requests.push(requestUrl.pathname);
      if (requestUrl.pathname === "/repos/artist/gridcraft-artworks") {
        return response({
          default_branch: "main",
          private: false,
          owner: { id: 8, login: "artist", avatar_url: "avatar", html_url: "profile" },
          permissions: { push: true },
        });
      }
      if (requestUrl.pathname.endsWith("/contents/forest/album.json")) {
        return response({
          content: Buffer.from(JSON.stringify(manifest)).toString("base64"),
          sha: "manifest-sha",
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      const result = await service.getAlbum("token", "artist", "forest");
      assert.equal(result.repo.defaultBranch, "main");
      assert.equal(result.repo.fullName, "artist/gridcraft-artworks/forest");
      assert.equal(result.manifest.description, "Woodland sprites");
      assert.ok(requests.includes("/repos/artist/gridcraft-artworks/contents/forest/album.json"));
      assert.equal(store.getAlbum("artist", "forest").defaultBranch, "main");
    } finally {
      store.close();
    }
  });
});
