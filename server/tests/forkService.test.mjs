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
});
