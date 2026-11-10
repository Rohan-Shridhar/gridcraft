import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { config } from "../src/config/env.js";
import { signSessionPayload, encryptToken } from "../src/utils/crypto.js";
import {
  slugifyRepoName,
  CreateAlbumSchema,
  AlbumManifestSchema,
} from "../src/validators/albumValidator.js";

describe("Album Validator Tests", () => {
  it("slugifies repository names correctly", () => {
    assert.equal(slugifyRepoName("Minecraft Items"), "minecraft-items");
    assert.equal(slugifyRepoName("  Sword & Shield!!  "), "sword-shield");
    assert.equal(slugifyRepoName("Pixel_Art_123"), "pixel-art-123");
    assert.equal(slugifyRepoName("---spaced---"), "spaced");
  });

  it("validates repository name constraints with CreateAlbumSchema", () => {
    const valid = CreateAlbumSchema.parse({
      name: "pixel-creatures",
      description: "My custom sprites",
      isPrivate: false,
    });
    assert.equal(valid.name, "pixel-creatures");
    assert.equal(valid.isPrivate, false);

    assert.throws(() => {
      CreateAlbumSchema.parse({ name: "-invalid-start" });
    });

    assert.throws(() => {
      CreateAlbumSchema.parse({ name: ".hidden-repo" });
    });

    assert.throws(() => {
      CreateAlbumSchema.parse({ name: "has spaces in name" });
    });
  });

  it("validates album manifest schema", () => {
    const manifest = {
      format: "gridcraft-album",
      schemaVersion: 1,
      id: "game-assets",
      name: "Game Assets",
      description: "Retro assets",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdWith: {
        name: "GridCraft",
        version: "3.5.0",
      },
    };

    const parsed = AlbumManifestSchema.parse(manifest);
    assert.equal(parsed.format, "gridcraft-album");
    assert.equal(parsed.name, "Game Assets");

    assert.throws(() => {
      AlbumManifestSchema.parse({ ...manifest, format: "invalid-format" });
    });
  });
});

describe("Album API Integration Tests", () => {
  const dummyUser = {
    id: 101,
    login: "craftmaster",
    name: "Craft Master",
    avatarUrl: "https://github.com/craftmaster.png",
    htmlUrl: "https://github.com/craftmaster",
  };

  const encryptedToken = encryptToken("ghu_valid_test_token_123", config.session.encryptionKey);
  const authCookie = signSessionPayload(
    { user: dummyUser, encryptedToken, createdAt: Date.now() },
    config.session.secret
  );

  it("rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/albums");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("lists albums accessible to the authenticated user", async () => {
    const mockService = {
      listAlbums: async (token, { page, perPage }) => {
        assert.equal(token, "ghu_valid_test_token_123");
        return {
          albums: [
            {
              id: 991,
              name: "pixel-monsters",
              fullName: "craftmaster/pixel-monsters",
              owner: "craftmaster",
              ownerAvatar: "https://github.com/craftmaster.png",
              description: "Monsters album",
              isPrivate: false,
              defaultBranch: "master",
              htmlUrl: "https://github.com/craftmaster/pixel-monsters",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              isGridCraftAlbum: true,
              permissions: { admin: true, push: true, pull: true },
            },
          ],
          page,
          perPage,
          total: 1,
        };
      },
    };

    const app = createApp({ albumService: mockService });
    const res = await request(app)
      .get("/api/v1/albums?page=1&per_page=10")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.albums[0].name, "pixel-monsters");
    assert.equal(res.body.albums[0].defaultBranch, "master");
  });

  it("creates a new album repository, enforces master default branch, and commits manifest", async () => {
    const createdOperations = [];

    const mockService = {
      createAlbum: async (token, user, data) => {
        assert.equal(token, "ghu_valid_test_token_123");
        assert.equal(user.login, "craftmaster");
        createdOperations.push(`create_repo:${data.name}`);

        return {
          repo: {
            id: 888,
            name: "retro-rpg",
            fullName: "craftmaster/retro-rpg",
            owner: "craftmaster",
            ownerAvatar: "https://github.com/craftmaster.png",
            description: "Retro RPG Assets",
            isPrivate: true,
            defaultBranch: "master",
            htmlUrl: "https://github.com/craftmaster/retro-rpg",
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          manifest: {
            format: "gridcraft-album",
            schemaVersion: 1,
            id: "retro-rpg",
            name: "retro-rpg",
            description: "Retro RPG Assets",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdWith: { name: "GridCraft", version: "3.5.0" },
          },
        };
      },
    };

    const app = createApp({ albumService: mockService });
    const res = await request(app)
      .post("/api/v1/albums")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({
        name: "retro-rpg",
        description: "Retro RPG Assets",
        isPrivate: true,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.repo.name, "retro-rpg");
    assert.equal(res.body.repo.defaultBranch, "master");
    assert.equal(res.body.repo.isPrivate, true);
    assert.equal(res.body.manifest.format, "gridcraft-album");
    assert.deepEqual(createdOperations, ["create_repo:retro-rpg"]);
  });

  it("handles duplicate repository name conflict (409)", async () => {
    const mockService = {
      createAlbum: async () => {
        const error = new Error('Repository "duplicate-album" already exists.');
        error.status = 409;
        throw error;
      },
    };

    const app = createApp({ albumService: mockService });
    const res = await request(app)
      .post("/api/v1/albums")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({ name: "duplicate-album" });

    assert.equal(res.status, 409);
    assert.ok(res.body.error.message.includes("already exists"));
  });

  it("fetches album details and manifest", async () => {
    const mockService = {
      getAlbum: async (token, owner, repo) => {
        assert.equal(owner, "craftmaster");
        assert.equal(repo, "fantasy-props");
        return {
          repo: {
            id: 777,
            name: "fantasy-props",
            fullName: "craftmaster/fantasy-props",
            owner: "craftmaster",
            defaultBranch: "master",
            isPrivate: false,
          },
          manifest: {
            format: "gridcraft-album",
            schemaVersion: 1,
            name: "Fantasy Props",
          },
          isGridCraftAlbum: true,
        };
      },
    };

    const app = createApp({ albumService: mockService });
    const res = await request(app)
      .get("/api/v1/albums/craftmaster/fantasy-props")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.repo.name, "fantasy-props");
    assert.equal(res.body.isGridCraftAlbum, true);
  });

  it("requires matching confirmation name to delete an album", async () => {
    const mockService = {
      deleteAlbum: async (token, owner, repo, confirmName) => {
        if (confirmName !== repo) {
          const err = new Error("Confirmation name does not match repository name");
          err.status = 400;
          throw err;
        }
        return { success: true };
      },
    };

    const app = createApp({ albumService: mockService });

    // Mismatched confirmation name
    const badRes = await request(app)
      .delete("/api/v1/albums/craftmaster/my-repo")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({ confirmName: "wrong-name" });

    assert.equal(badRes.status, 400);

    // Matching confirmation name
    const goodRes = await request(app)
      .delete("/api/v1/albums/craftmaster/my-repo")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({ confirmName: "my-repo" });

    assert.equal(goodRes.status, 200);
    assert.equal(goodRes.body.success, true);
  });

  it("fetches album commit history and tree", async () => {
    const mockService = {
      listCommits: async (token, owner, repo, branch) => {
        assert.equal(branch, "master");
        return [
          {
            sha: "a1b2c3d4e5f6",
            shortSha: "a1b2c3d",
            message: "chore(gridcraft): initialize album",
            author: "craftmaster",
            date: "2026-11-10T10:00:00Z",
          },
        ];
      },
      getTree: async (token, owner, repo, branch) => {
        assert.equal(branch, "master");
        return [
          { path: ".gridcraft/album.json", type: "blob" },
          { path: "artworks", type: "tree" },
          { path: "stories", type: "tree" },
        ];
      },
    };

    const app = createApp({ albumService: mockService });

    const commitsRes = await request(app)
      .get("/api/v1/albums/craftmaster/retro/commits")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(commitsRes.status, 200);
    assert.equal(commitsRes.body.commits.length, 1);
    assert.equal(commitsRes.body.commits[0].shortSha, "a1b2c3d");

    const treeRes = await request(app)
      .get("/api/v1/albums/craftmaster/retro/tree")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(treeRes.status, 200);
    assert.equal(treeRes.body.tree.length, 3);
  });
});
