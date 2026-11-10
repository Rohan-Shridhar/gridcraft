import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppStore } from "../src/services/appStore.js";
import { AlbumService } from "../src/services/albumService.js";
import { ArtworkService } from "../src/services/artworkService.js";
import { PullRequestService } from "../src/services/pullRequestService.js";

const creator = { id: 1, login: "creator", name: "Creator" };
const contributor = { id: 2, login: "contributor", name: "Contributor" };

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function manifest(id, name = id) {
  const now = new Date().toISOString();
  return {
    format: "gridcraft-album",
    schemaVersion: 1,
    id,
    name,
    description: "",
    createdAt: now,
    updatedAt: now,
    createdWith: { name: "GridCraft", version: "4.0.0" },
  };
}

describe("GridCraft artwork library model", () => {
  it("creates album folders in one shared artwork repository", async () => {
    const store = new AppStore(":memory:");
    const requests = [];
    const service = new AlbumService(async (url, options) => {
      const requestUrl = new URL(url);
      requests.push({ path: requestUrl.pathname, method: options.method || "GET" });
      if (requestUrl.pathname === "/repos/creator/gridcraft-artworks") {
        return response({ default_branch: "main", private: false });
      }
      if (requestUrl.pathname.endsWith("/.gridcraft/catalog.json") && options.method !== "PUT") {
        return response({ message: "Not Found" }, 404);
      }
      if (requestUrl.pathname.endsWith("/git/trees/main")) {
        return response({ tree: [], truncated: false });
      }
      if (options.method === "PUT") {
        return response({
          content: {
            sha: "file-sha",
            html_url: `https://github.com/creator/gridcraft-artworks/blob/main${requestUrl.pathname}`,
          },
          commit: { sha: "commit-sha" },
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      const result = await service.createAlbum("token", creator, { name: "Forest Creatures" });
      assert.equal(result.repo.fullName, "creator/gridcraft-artworks/forest-creatures");
      assert.match(result.repo.htmlUrl, /\/tree\/main\/forest-creatures$/);
      assert.equal(store.getAlbum("creator", "forest-creatures").name, "Forest Creatures");
      assert.ok(requests.some(({ path, method }) => (
        method === "PUT" && path.endsWith("/contents/forest-creatures/album.json")
      )));
      assert.ok(requests.every(({ path }) => !path.includes("/contents/albums/")));
    } finally {
      store.close();
    }
  });

  it("stores artworks directly inside their Story folder", async () => {
    const store = new AppStore(":memory:");
    store.createAlbum(creator, { slug: "forest", name: "Forest" });
    const now = new Date().toISOString();
    const story = {
      format: "gridcraft-story",
      schemaVersion: 1,
      id: "opening",
      name: "Opening",
      description: "",
      loop: true,
      defaultFrameDurationMs: 150,
      frames: [],
      createdAt: now,
      updatedAt: now,
    };
    const paths = [];
    const service = new ArtworkService(async (url, options) => {
      const requestUrl = new URL(url);
      paths.push({ path: requestUrl.pathname, method: options.method || "GET" });
      if (requestUrl.pathname.endsWith("/forest/opening/story.json")) {
        return response({ content: Buffer.from(JSON.stringify(story)).toString("base64") });
      }
      if (options.method === "PUT") {
        return response({ content: { sha: "artwork-sha" }, commit: { sha: "commit-sha" } });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      await service.createArtwork("token", creator, "creator", "forest", "opening", {
        name: "Fern",
        gridSize: 16,
      });
      assert.ok(paths.some(({ path, method }) => (
        method === "PUT" && path.endsWith("/contents/forest/opening/fern.json")
      )));
    } finally {
      store.close();
    }
  });

  it("copies every album file into a distinct folder in the forking user's library", async () => {
    const store = new AppStore(":memory:");
    const source = store.createAlbum(creator, {
      slug: "forest",
      name: "Forest",
      description: "A collection",
    });
    const files = [
      { path: "forest/album.json", sha: "manifest-sha", content: manifest("forest", "Forest") },
      {
        path: "forest/opening/story.json",
        sha: "story-sha",
        content: { format: "gridcraft-story", id: "opening" },
      },
      {
        path: "forest/opening/fern.json",
        sha: "artwork-sha",
        content: { format: "gridcraft-artwork", id: "fern" },
      },
    ];
    const copiedPaths = [];
    const service = new AlbumService(async (url, options) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === "/repos/contributor/gridcraft-artworks") {
        return response({ default_branch: "main", private: false });
      }
      if (requestUrl.pathname.endsWith("/.gridcraft/catalog.json")) {
        return response({ content: "e30=", sha: "catalog-sha" });
      }
      if (requestUrl.pathname === "/repos/creator/gridcraft-artworks") {
        return response({ default_branch: "main", private: false });
      }
      if (requestUrl.pathname.endsWith("/git/trees/main")) {
        return response({ tree: files.map(({ path, sha }) => ({ path, sha, type: "blob" })), truncated: false });
      }
      const blob = files.find((file) => requestUrl.pathname.endsWith(`/git/blobs/${file.sha}`));
      if (blob) {
        return response({
          encoding: "base64",
          content: Buffer.from(JSON.stringify(blob.content)).toString("base64"),
        });
      }
      if (options.method === "PUT") {
        copiedPaths.push(requestUrl.pathname);
        return response({ content: { sha: `copied-${copiedPaths.length}` }, commit: { sha: "commit" } });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      const result = await service.forkAlbum("token", contributor, "creator", "forest");
      assert.equal(result.repo.slug, "forest");
      assert.equal(result.repo.parent.slug, source.slug);
      assert.equal(store.getAlbum("contributor", "forest").parent.slug, "forest");
      assert.deepEqual(copiedPaths.map((path) => path.split("/contents/")[1]), [
        "forest/album.json",
        "forest/opening/story.json",
        "forest/opening/fern.json",
      ]);
    } finally {
      store.close();
    }
  });

  it("paginates GridCraft issue comments and tracks pull-request file snapshots", () => {
    const store = new AppStore(":memory:");
    const base = store.createAlbum(creator, { slug: "base", name: "Base" });
    const head = store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });

    try {
      const { issue } = store.createIssue(base.id, contributor, {
        title: "Add a forest scene",
        labels: ["art"],
      });
      for (let index = 0; index < 21; index += 1) {
        store.addIssueComment(issue.number, creator, `Comment ${index + 1}`);
      }
      const firstPage = store.getIssue(issue.number, { page: 1, perPage: 20 });
      const secondPage = store.getIssue(issue.number, { page: 2, perPage: 20 });
      assert.equal(firstPage.comments.length, 20);
      assert.equal(firstPage.commentsHasNext, true);
      assert.equal(secondPage.comments.length, 1);
      assert.equal(secondPage.commentsHasNext, false);

      store.createPull({
        baseAlbumId: base.id,
        headAlbumId: head.id,
        author: contributor,
        title: "Propose forest scene",
        files: [
          { path: "opening/fern.json", baseSha: null, headSha: "new-sha" },
          { path: "opening/story.json", baseSha: "old-sha", headSha: "updated-sha" },
        ],
      });
      const pull = store.listPulls(base.id).pulls[0];
      assert.equal(pull.changedFiles, 2);
      assert.equal(pull.base.ref, "base");
      assert.equal(pull.head.ref, "proposal");
    } finally {
      store.close();
    }
  });

  it("rejects a GridCraft pull request when a snapshotted base file changed", async () => {
    const store = new AppStore(":memory:");
    store.createAlbum(creator, { slug: "base", name: "Base" });
    store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });
    const created = store.createPull({
      baseAlbumId: store.getAlbum("creator", "base").id,
      headAlbumId: store.getAlbum("contributor", "proposal").id,
      author: contributor,
      title: "Update artwork",
      files: [{ path: "opening/fern.json", baseSha: "old-sha", headSha: "head-sha" }],
    });
    const service = new PullRequestService(async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname.endsWith("/gridcraft-artworks")) {
        return response({ default_branch: "main" });
      }
      if (requestUrl.pathname.endsWith("/git/trees/main")) {
        const owner = requestUrl.pathname.split("/")[2];
        const sha = owner === "creator" ? "changed-base-sha" : "head-sha";
        const slug = owner === "creator" ? "base" : "proposal";
        return response({
          truncated: false,
          tree: [{ path: `${slug}/opening/fern.json`, sha, type: "blob" }],
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      await assert.rejects(
        service.mergePull("token", "creator", "base", creator, created.pull.number),
        (error) => error.status === 409 && error.code === "CONFLICT"
      );
    } finally {
      store.close();
    }
  });
});
