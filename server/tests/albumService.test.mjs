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

  it("preserves mapped parent metadata using the parent owner's default branch and bounds deduplicated fork slugs to 100 chars", async () => {
    const creator = { id: 1, login: "creator", name: "Creator" };
    const artist = { id: 8, login: "artist", name: "Artist" };
    const store = new AppStore(":memory:");
    const longSlug = `${"a".repeat(98)}-x`;
    const source = store.createAlbum(creator, { slug: longSlug, name: "Long Album" });
    store.setUserDefaultBranch(creator.id, "develop");
    store.createAlbum(artist, { slug: longSlug, name: "Existing Same Slug" });

    const sourceManifest = {
      format: "gridcraft-album",
      schemaVersion: 1,
      id: longSlug,
      name: "Long Album",
      description: "Parent album",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdWith: { name: "GridCraft", version: "4.0.0" },
    };
    let forkedManifest = null;
    const service = new AlbumService(async (url, options = {}) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === "/repos/artist/gridcraft-artworks") {
        return response({
          default_branch: "main",
          private: false,
          owner: { id: 8, login: "artist", avatar_url: "avatar", html_url: "profile" },
          permissions: { push: true },
        });
      }
      if (requestUrl.pathname === "/repos/creator/gridcraft-artworks") {
        return response({
          default_branch: "develop",
          private: false,
          owner: { id: 1, login: "creator", avatar_url: "avatar", html_url: "profile" },
        });
      }
      if (requestUrl.pathname.endsWith("/.gridcraft/catalog.json")) {
        return response({ content: "e30=", sha: "catalog-sha" });
      }
      if (requestUrl.pathname.endsWith("/git/trees/develop")) {
        return response({
          truncated: false,
          tree: [{ path: `${longSlug}/album.json`, sha: "manifest-blob-sha", type: "blob" }],
        });
      }
      if (requestUrl.pathname.endsWith("/git/blobs/manifest-blob-sha")) {
        return response({
          encoding: "base64",
          content: Buffer.from(JSON.stringify(sourceManifest)).toString("base64"),
        });
      }
      if (options.method === "PUT") {
        const body = JSON.parse(options.body);
        forkedManifest = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
        return response({ content: { sha: "fork-manifest-sha" }, commit: { sha: "commit-sha" } });
      }
      if (requestUrl.pathname.endsWith("/album.json")) {
        return response({
          content: Buffer.from(JSON.stringify(forkedManifest)).toString("base64"),
          sha: "fork-manifest-sha",
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      const forked = await service.forkAlbum("token", artist, "creator", longSlug);
      assert.ok(forked.repo.slug.length <= 100);
      assert.equal(forked.repo.slug, `${"a".repeat(98)}-2`);
      assert.equal(forked.repo.parent.fullName, `creator/gridcraft-artworks/${longSlug}`);
      assert.equal(
        forked.repo.parent.htmlUrl,
        `https://github.com/creator/gridcraft-artworks/tree/develop/${longSlug}`
      );

      const loaded = await service.getAlbum("token", "artist", forked.repo.slug);
      assert.equal(loaded.repo.parent.owner, "creator");
      assert.equal(loaded.repo.parent.slug, source.slug);
      assert.equal(loaded.repo.parent.fullName, `creator/gridcraft-artworks/${longSlug}`);
      assert.equal(
        loaded.repo.parent.htmlUrl,
        `https://github.com/creator/gridcraft-artworks/tree/develop/${longSlug}`
      );
    } finally {
      store.close();
    }
  });
});
