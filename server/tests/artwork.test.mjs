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

  it("rejects unauthenticated requests to artworks endpoint with 401 UNAUTHORIZED", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/albums/pixelcrafter/my-repo/artworks");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("lists artworks in an album", async () => {
    const mockService = {
      listArtworks: async (token, owner, repo, branch) => {
        assert.equal(owner, "pixelcrafter");
        assert.equal(repo, "rpg-items");
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
      .get("/api/v1/albums/pixelcrafter/rpg-items/artworks")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.artworks.length, 1);
    assert.equal(res.body.artworks[0].id, "wooden-sword");
    assert.equal(res.body.artworks[0].sha, "sha_wood_123");
  });

  it("creates a new artwork JSON file with initial empty canvas", async () => {
    let capturedCommitMessage = null;

    const mockService = {
      createArtwork: async (token, user, owner, repo, data, branch) => {
        assert.equal(owner, "pixelcrafter");
        assert.equal(repo, "rpg-items");
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
      .post("/api/v1/albums/pixelcrafter/rpg-items/artworks")
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
      getArtwork: async (token, owner, repo, artworkId, branch) => {
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
      .get("/api/v1/albums/pixelcrafter/rpg-items/artworks/golden-apple")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.artwork.id, "golden-apple");
    assert.equal(res.body.sha, "sha_apple_777");
  });

  it("saves artwork JSON with matching SHA (optimistic concurrency success)", async () => {
    const cells = Array(256).fill(null);
    cells[0] = "#e63946";

    const mockService = {
      saveArtwork: async (token, user, owner, repo, artworkId, payload, branch) => {
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
      .put("/api/v1/albums/pixelcrafter/rpg-items/artworks/diamond-sword")
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
      .put("/api/v1/albums/pixelcrafter/rpg-items/artworks/stale-artwork")
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
      deleteArtwork: async (token, user, owner, repo, artworkId, sha, branch) => {
        deletedId = artworkId;
        return { success: true, artworkId };
      },
      getArtworkHistory: async (token, owner, repo, artworkId, branch) => {
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
      .get("/api/v1/albums/pixelcrafter/rpg-items/artworks/shield/commits")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`]);

    assert.equal(historyRes.status, 200);
    assert.equal(historyRes.body.commits.length, 1);
    assert.equal(historyRes.body.commits[0].shortSha, "comm123");

    // Delete
    const deleteRes = await request(app)
      .delete("/api/v1/albums/pixelcrafter/rpg-items/artworks/shield")
      .set("Cookie", [`${config.session.cookieName}=${authCookie}`])
      .send({ sha: "sha_to_delete" });

    assert.equal(deleteRes.status, 200);
    assert.equal(deletedId, "shield");
  });
});
