import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { config } from "../src/config/env.js";
import { signSessionPayload, encryptToken } from "../src/utils/crypto.js";
import {
  ArtworkSchema,
  CreateArtworkInputSchema,
  sanitizeArtworkId,
  SUPPORTED_GRID_SIZES,
} from "../src/validators/artworkValidator.js";
import { ArtworkService } from "../src/services/artworkService.js";

describe("Artwork Validator and Data Model Tests", () => {
  it("sanitizes artwork IDs and prevents path traversal", () => {
    assert.equal(sanitizeArtworkId("Diamond Sword"), "diamond-sword");
    assert.equal(sanitizeArtworkId("../../danger/file"), "danger-file");
    assert.equal(sanitizeArtworkId("creeper_face_v2!"), "creeper-face-v2");
    assert.equal(sanitizeArtworkId("  ---trim-me---  "), "trim-me");
  });

  it("validates exact pixel round-trips for all supported grid sizes: 16, 32, 64, 128", () => {
    for (const size of SUPPORTED_GRID_SIZES) {
      const cellCount = size * size;
      const cells = Array(cellCount).fill(null);
      // Paint some test pixels
      cells[0] = "#ff0000";
      cells[cellCount - 1] = "#00ff00";

      const artwork = {
        format: "gridcraft-artwork",
        schemaVersion: 1,
        id: `test-${size}`,
        name: `Test ${size}x${size}`,
        description: `Canvas size ${size}`,
        gridSize: size,
        width: size,
        height: size,
        backgroundColor: "transparent",
        cells,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = ArtworkSchema.parse(artwork);
      assert.equal(parsed.gridSize, size);
      assert.equal(parsed.cells.length, cellCount);
      assert.equal(parsed.cells[0], "#ff0000");
      assert.equal(parsed.cells[1], null);
      assert.equal(parsed.cells[cellCount - 1], "#00ff00");
    }
  });

  it("preserves transparent cells and custom background color", () => {
    const cells = Array(256).fill(null);
    cells[10] = "#abcdef";

    const artwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id: "transparent-check",
      name: "Transparent Check",
      gridSize: 16,
      width: 16,
      height: 16,
      backgroundColor: "#1a1a1a",
      cells,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = ArtworkSchema.parse(artwork);
    assert.equal(parsed.backgroundColor, "#1a1a1a");
    assert.equal(parsed.cells[0], null);
    assert.equal(parsed.cells[10], "#abcdef");
  });

  it("rejects artwork when cells array length does not match gridSize * gridSize", () => {
    const invalidArtwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id: "bad-cells",
      name: "Bad Cells",
      gridSize: 16,
      width: 16,
      height: 16,
      backgroundColor: "transparent",
      cells: Array(255).fill(null), // 255 instead of 256
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.throws(() => {
      ArtworkSchema.parse(invalidArtwork);
    });
  });

  it("rejects artwork payloads larger than the maximum supported grid", () => {
    const oversizedArtwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id: "oversized",
      name: "Oversized",
      gridSize: 128,
      width: 128,
      height: 128,
      backgroundColor: "transparent",
      cells: Array(128 * 128 + 1).fill(null),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assert.throws(() => ArtworkSchema.parse(oversizedArtwork));
  });

  it("rejects invalid hex colors and malformed formats", () => {
    const cells = Array(256).fill(null);
    cells[5] = "not-a-hex-color";

    const invalidArtwork = {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id: "bad-color",
      name: "Bad Color",
      gridSize: 16,
      width: 16,
      height: 16,
      backgroundColor: "transparent",
      cells,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.throws(() => {
      ArtworkSchema.parse(invalidArtwork);
    });
  });
});

describe("Artwork GitHub persistence", () => {
  const ownerUser = { id: 100, login: "pixelcrafter" };
  const store = { getAlbum: () => ({ id: 1, owner: "pixelcrafter", slug: "rpg-items" }) };
  const story = {
    format: "gridcraft-story",
    schemaVersion: 1,
    id: "opening",
    name: "Opening",
    description: "",
    loop: true,
    defaultFrameDurationMs: 150,
    frames: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("saves exact pixel data and the SHA for each supported grid size", async () => {
    for (const gridSize of SUPPORTED_GRID_SIZES) {
      const expectedCells = Array.from({ length: gridSize * gridSize }, (_, index) =>
        index % 3 === 0 ? "#a1b2c3" : null
      );
      let writtenFile;
      const service = new ArtworkService(async (url, options) => {
        if (url.includes("/contents/rpg-items/opening/story.json")) {
          return new Response(JSON.stringify({ content: Buffer.from(JSON.stringify(story)).toString("base64") }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        assert.match(url, /\/contents\/rpg-items\/opening\/round-trip\.json$/);
        writtenFile = JSON.parse(options.body);
        return new Response(JSON.stringify({
          content: { sha: `new-sha-${gridSize}` },
          commit: { sha: `commit-sha-${gridSize}` },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }, store);

      const createdAt = new Date().toISOString();
      const result = await service.saveArtwork(
        "test-token",
        ownerUser,
        "pixelcrafter",
        "rpg-items",
        "opening",
        "round-trip",
        {
          sha: `old-sha-${gridSize}`,
          name: `Round trip ${gridSize}`,
          description: "Exact pixels",
          gridSize,
          backgroundColor: "#123456",
          cells: expectedCells,
          createdAt,
        }
      );
      const stored = JSON.parse(Buffer.from(writtenFile.content, "base64").toString("utf8"));

      assert.equal(writtenFile.sha, `old-sha-${gridSize}`);
      assert.deepEqual(stored.cells, expectedCells);
      assert.equal(stored.gridSize, gridSize);
      assert.equal(stored.backgroundColor, "#123456");
      assert.equal(result.sha, `new-sha-${gridSize}`);
    }
  });

  it("requires a SHA for updates and propagates stale-SHA conflicts", async () => {
    let requestCount = 0;
    const service = new ArtworkService(async (url, options) => {
      requestCount += 1;
      if (url.includes("/contents/repo/story/story.json")) {
        return new Response(JSON.stringify({ content: Buffer.from(JSON.stringify(story)).toString("base64") }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      assert.equal(options.method, "PUT");
      return new Response(JSON.stringify({ message: "sha was used but the file changed" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }, { getAlbum: () => ({ id: 1, slug: "repo" }) });

    await assert.rejects(
      service.saveArtwork("token", { id: 1, login: "owner" }, "owner", "repo", "story", "art", { cells: [] }),
      /SHA is required/
    );
    assert.equal(requestCount, 1);

    await assert.rejects(
      service.saveArtwork("token", { id: 1, login: "owner" }, "owner", "repo", "story", "art", {
        sha: "stale-sha",
        name: "Art",
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
      }),
      (error) => error.status === 409 && error.code === "CONFLICT"
    );
  });
});

describe("Artwork API Integration Tests", () => {
  const dummyUser = {
    id: 101,
    login: "pixelcrafter",
    name: "Pixel Crafter",
  };

  const encryptedToken = encryptToken("ghu_valid_test_token_456", config.session.encryptionKey);
  const authCookie = signSessionPayload(
    { user: dummyUser, encryptedToken, createdAt: Date.now() },
    config.session.secret
  );

  it("rejects unauthenticated requests to nested artwork endpoints with 401 UNAUTHORIZED", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/albums/pixelcrafter/my-repo/stories/opening/artworks");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("rejects oversized JSON requests with a useful 413 error", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({
        name: "oversized",
        gridSize: 16,
        description: "x".repeat(2 * 1024 * 1024),
      });

    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "PAYLOAD_TOO_LARGE");
    assert.match(res.body.error.message, /2 MB limit/);
  });

  it("lists artworks in an album", async () => {
    const mockService = {
      listArtworks: async (token, owner, repo, storyId, branch) => {
        assert.equal(owner, "pixelcrafter");
        assert.equal(repo, "rpg-items");
        assert.equal(storyId, "opening");
        assert.equal(branch, "master");
        return [
          {
            format: "gridcraft-artwork",
            schemaVersion: 1,
            id: "wooden-sword",
            name: "Wooden Sword",
            gridSize: 16,
            width: 16,
            height: 16,
            backgroundColor: "transparent",
            cells: Array(256).fill(null),
            sha: "sha_wood_123",
          },
        ];
      },
    };

    const app = createApp({ artworkService: mockService });
    const res = await request(app)
      .get("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.artworks.length, 1);
    assert.equal(res.body.artworks[0].id, "wooden-sword");
    assert.equal(res.body.artworks[0].sha, "sha_wood_123");
  });

  it("creates a new artwork JSON file with initial empty canvas", async () => {
    let capturedCommitMessage = null;

    const mockService = {
      createArtwork: async (token, user, owner, repo, storyId, data, branch) => {
        assert.equal(owner, "pixelcrafter");
        assert.equal(repo, "rpg-items");
        assert.equal(storyId, "opening");
        assert.equal(branch, "master");
        capturedCommitMessage = `feat(artwork): add ${data.name}`;

        return {
          artwork: {
            format: "gridcraft-artwork",
            schemaVersion: 1,
            id: data.name,
            name: data.name,
            gridSize: data.gridSize,
            width: data.gridSize,
            height: data.gridSize,
            backgroundColor: "transparent",
            cells: Array(data.gridSize * data.gridSize).fill(null),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          sha: "sha_created_999",
          commitSha: "commit_sha_aaa",
        };
      },
    };

    const app = createApp({ artworkService: mockService });
    const res = await request(app)
      .post("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({
        name: "iron-pickaxe",
        description: "Iron pickaxe tool",
        gridSize: 16,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.artwork.id, "iron-pickaxe");
    assert.equal(res.body.sha, "sha_created_999");
    assert.equal(capturedCommitMessage, "feat(artwork): add iron-pickaxe");
  });

  it("fetches single artwork JSON and file SHA", async () => {
    const mockService = {
      getArtwork: async (token, owner, repo, storyId, artworkId, branch) => {
        assert.equal(storyId, "opening");
        assert.equal(artworkId, "golden-apple");
        return {
          artwork: {
            format: "gridcraft-artwork",
            schemaVersion: 1,
            id: "golden-apple",
            name: "Golden Apple",
            gridSize: 16,
            width: 16,
            height: 16,
            backgroundColor: "transparent",
            cells: Array(256).fill(null),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          sha: "sha_apple_777",
        };
      },
    };

    const app = createApp({ artworkService: mockService });
    const res = await request(app)
      .get("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks/golden-apple")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.artwork.id, "golden-apple");
    assert.equal(res.body.sha, "sha_apple_777");
  });

  it("saves artwork JSON with matching SHA (optimistic concurrency success)", async () => {
    const cells = Array(256).fill(null);
    cells[0] = "#e63946";

    const mockService = {
      saveArtwork: async (token, user, owner, repo, storyId, artworkId, payload, branch) => {
        assert.equal(storyId, "opening");
        assert.equal(artworkId, "diamond-sword");
        assert.equal(payload.sha, "expected_sha_123");
        return {
          artwork: payload.artwork,
          sha: "new_sha_456",
          commitSha: "commit_sha_update",
        };
      },
    };

    const app = createApp({ artworkService: mockService });
    const res = await request(app)
      .put("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks/diamond-sword")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({
        sha: "expected_sha_123",
        commitMessage: "update(artwork): refine diamond-sword blade",
        artwork: {
          format: "gridcraft-artwork",
          schemaVersion: 1,
          id: "diamond-sword",
          name: "Diamond Sword",
          gridSize: 16,
          width: 16,
          height: 16,
          backgroundColor: "transparent",
          cells,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.sha, "new_sha_456");
    assert.equal(res.body.commitSha, "commit_sha_update");
  });

  it("rejects save and returns 409 CONFLICT when remote file SHA is stale", async () => {
    const mockService = {
      saveArtwork: async () => {
        const error = new Error("Stale write detected. The remote artwork has been modified.");
        error.status = 409;
        error.code = "CONFLICT";
        throw error;
      },
    };

    const app = createApp({ artworkService: mockService });
    const res = await request(app)
      .put("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks/stale-artwork")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({
        sha: "old_sha_mismatch",
        artwork: {
          format: "gridcraft-artwork",
          schemaVersion: 1,
          id: "stale-artwork",
          name: "Stale Artwork",
          gridSize: 16,
          width: 16,
          height: 16,
          backgroundColor: "transparent",
          cells: Array(256).fill(null),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "CONFLICT");
  });

  it("deletes artwork file and queries commit history", async () => {
    let deletedId = null;

    const mockService = {
      deleteArtwork: async (token, user, owner, repo, storyId, artworkId, sha, branch) => {
        deletedId = artworkId;
        return { success: true, artworkId };
      },
      getArtworkHistory: async (token, owner, repo, storyId, artworkId, branch) => {
        return [
          {
            sha: "commit_1",
            shortSha: "comm123",
            message: "feat(artwork): add shield",
            author: "pixelcrafter",
            date: "2026-11-10T11:00:00Z",
          },
        ];
      },
    };

    const app = createApp({ artworkService: mockService });

    // History
    const historyRes = await request(app)
      .get("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks/shield/commits")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(historyRes.status, 200);
    assert.equal(historyRes.body.commits.length, 1);
    assert.equal(historyRes.body.commits[0].shortSha, "comm123");

    // Delete
    const deleteRes = await request(app)
      .delete("/api/v1/albums/pixelcrafter/rpg-items/stories/opening/artworks/shield")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({ sha: "sha_to_delete" });

    assert.equal(deleteRes.status, 200);
    assert.equal(deletedId, "shield");
  });
});
