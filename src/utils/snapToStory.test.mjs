import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeArtworkId, snapsToMigrationPlan } from "./snapToStory.mjs";

describe("Snap-to-Story migration plan", () => {
  it("preserves order, labels, notes, pixels, and frame durations", () => {
    const snaps = [
      { id: "one", title: "First frame", caption: "caption", notes: "notes", durationMs: 1200, gridSize: 16, backgroundColor: "transparent", cells: Array(256).fill(null) },
      { id: "two", title: "Second frame", durationMs: 2400, gridSize: 16, backgroundColor: "#ffffff", cells: Array(256).fill("#123456") },
    ];
    const plan = snapsToMigrationPlan(snaps, { albumId: "owner/repo" });

    assert.equal(plan.artworks.length, 2);
    assert.equal(plan.artworks[0].name, "First frame");
    assert.equal(plan.artworks[0].description, "caption\nnotes");
    assert.deepEqual(plan.artworks[1].cells, snaps[1].cells);
    assert.deepEqual(plan.story.frames.map((item) => item.artworkId), ["first-frame", "second-frame"]);
    assert.deepEqual(plan.story.frames.map((item) => item.durationMs), [1200, 2400]);
    assert.equal(plan.story.loop, true);
    assert.equal(plan.skippedCount, 0);
  });

  it("skips invalid pixels and bounds migrated frame metadata", () => {
    const plan = snapsToMigrationPlan([
      { title: "Bad frame", gridSize: 16, backgroundColor: "transparent", cells: ["red"] },
      {
        title: "Long notes",
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
        notes: "n".repeat(900),
      },
    ]);

    assert.equal(plan.skippedCount, 1);
    assert.equal(plan.artworks.length, 1);
    assert.equal(plan.truncatedMetadataCount, 1);
    assert.equal(plan.artworks[0].description.length, 500);
  });

  it("normalizes whitespace-only titles, bounds deduplicated IDs to 100 chars, and replaces invalid createdAt dates", () => {
    const longTitle = "a".repeat(100);
    const plan = snapsToMigrationPlan([
      {
        title: "   ",
        createdAt: "not-a-date",
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
      },
      {
        title: longTitle,
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
      },
      {
        title: longTitle,
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
      },
    ]);

    assert.equal(plan.artworks[0].name, "Snap 1");
    assert.equal(plan.artworks[0].id, "snap-1");
    assert.ok(Number.isFinite(Date.parse(plan.artworks[0].createdAt)));
    assert.equal(plan.artworks[1].id.length, 100);
    assert.ok(plan.artworks[2].id.length <= 100);
    assert.ok(plan.artworks[2].id.endsWith("-2"));
    assert.notEqual(plan.artworks[1].id, plan.artworks[2].id);
  });

  it("strips trailing hyphens after truncation, rejects sparse cells, and normalizes storyName", () => {
    assert.equal(sanitizeArtworkId(`${"a".repeat(99)}-extra`), "a".repeat(99));

    const sparseCells = new Array(256);
    const plan = snapsToMigrationPlan(
      [
        {
          title: "Sparse",
          gridSize: 16,
          backgroundColor: "transparent",
          cells: sparseCells,
        },
      ],
      { storyName: "   " }
    );

    assert.equal(plan.artworks.length, 0);
    assert.equal(plan.skippedCount, 1);
    assert.equal(plan.story.name, "Migrated Snaps");
    assert.equal(plan.story.id, "migrated-snaps");

    const nonArrayPlan = snapsToMigrationPlan("invalid");
    assert.equal(nonArrayPlan.artworks.length, 0);
    assert.equal(nonArrayPlan.skippedCount, 0);
  });
});
