import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForkService } from "../src/services/forkService.js";

describe("GridCraft album forks", () => {
  it("lists copied album folders owned by the signed-in user", () => {
    const service = new ForkService({
      store: {
        listUserAlbums: (id) => {
          assert.equal(id, 12);
          return [
            {
              id: 1,
              owner: "artist",
              slug: "forest-fork",
              name: "Forest (fork)",
              description: "",
              defaultBranch: "main",
              parent: { owner: "creator", slug: "forest" },
              createdAt: "2026-01-01",
              updatedAt: "2026-01-02",
            },
            { id: 2, owner: "artist", slug: "independent", parent: null },
          ];
        },
      },
    });

    const result = service.listUserForks("token", { id: 12 }, { page: 1, perPage: 10 });
    assert.equal(result.total, 1);
    assert.equal(result.forks[0].fullName, "artist/gridcraft-artworks/forest-fork");
    assert.equal(result.forks[0].parent.fullName, "creator/gridcraft-artworks/forest");
    assert.match(result.forks[0].htmlUrl, /\/tree\/main\/forest-fork$/);
  });

  it("normalizes invalid pagination options and includes parent defaultBranch and htmlUrl", () => {
    const service = new ForkService({
      store: {
        listUserAlbums: () => [
          {
            id: 1,
            owner: "artist",
            slug: "forest-fork",
            description: "",
            defaultBranch: "main",
            parent: { owner: "creator", slug: "forest", defaultBranch: "develop" },
            createdAt: "2026-01-01",
            updatedAt: "2026-01-02",
          },
        ],
      },
    });

    const result = service.listUserForks("token", { id: 12 }, { page: 0, perPage: -5 });
    assert.equal(result.page, 1);
    assert.equal(result.perPage, 30);
    assert.equal(result.forks.length, 1);
    assert.equal(result.forks[0].parent.defaultBranch, "develop");
    assert.equal(
      result.forks[0].parent.htmlUrl,
      "https://github.com/creator/gridcraft-artworks/tree/develop/forest"
    );
  });
});
