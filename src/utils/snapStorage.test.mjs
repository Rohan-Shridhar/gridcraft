import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SLIDE_DURATION_MS,
  MAX_SNAP_COUNT,
  SNAP_SCHEMA_VERSION,
  parseStoredSnaps,
  serializeStoredSnaps,
} from "./snapStorage.mjs";

function makeSnap(overrides = {}) {
  return {
    id: "snap-1",
    createdAt: "2026-10-18T00:00:00.000Z",
    sequence: 1,
    title: "Snap 1",
    cells: Array(16 * 16).fill(null),
    gridSize: 16,
    backgroundColor: "transparent",
    ...overrides,
  };
}

test("empty storage is safe to initialize", () => {
  assert.deepEqual(parseStoredSnaps(null), {
    snaps: [],
    notice: null,
    canPersist: true,
  });
});

test("migrates legacy snapshots with storyboard defaults and copied cells", () => {
  const legacySnap = makeSnap();
  const result = parseStoredSnaps(
    JSON.stringify({ version: 1, snaps: [legacySnap] })
  );

  assert.equal(result.canPersist, true);
  assert.equal(result.snaps[0].durationMs, DEFAULT_SLIDE_DURATION_MS);
  assert.equal(result.snaps[0].includedInPresentation, true);
  assert.equal(result.snaps[0].caption, "");
  assert.equal(result.snaps[0].notes, "");
  assert.notEqual(result.snaps[0].cells, legacySnap.cells);
});

test("does not mark partial or unsupported stored data safe to overwrite", () => {
  const result = parseStoredSnaps(
    JSON.stringify({
      version: SNAP_SCHEMA_VERSION,
      snaps: [makeSnap(), makeSnap({ id: "bad", gridSize: 15 })],
    })
  );
  assert.equal(result.snaps.length, 1);
  assert.equal(result.canPersist, false);
  assert.match(result.notice, /invalid saved snaps/);

  const unsupported = parseStoredSnaps(JSON.stringify({ version: 999, snaps: [] }));
  assert.equal(unsupported.canPersist, false);
  assert.equal(unsupported.snaps.length, 0);
});

test("rejects malformed JSON without a success-shaped empty result", () => {
  assert.throws(() => parseStoredSnaps("{malformed"));
});

test("caps stored snapshots and serializes the current schema version", () => {
  const tooMany = parseStoredSnaps(
    JSON.stringify({
      version: SNAP_SCHEMA_VERSION,
      snaps: Array.from({ length: MAX_SNAP_COUNT + 1 }, (_, index) =>
        makeSnap({ id: `snap-${index}`, sequence: index + 1 })
      ),
    })
  );
  assert.equal(tooMany.snaps.length, MAX_SNAP_COUNT + 1);
  assert.equal(tooMany.canPersist, false);

  assert.equal(
    JSON.parse(serializeStoredSnaps([makeSnap()])).version,
    SNAP_SCHEMA_VERSION
  );
});

test("strips unknown properties and rejects invalid color and metadata fields", () => {
  const result = parseStoredSnaps(
    JSON.stringify({
      version: SNAP_SCHEMA_VERSION,
      snaps: [
        makeSnap({
          svgDataUrl: "data:image/svg+xml,...",
          cells: ["url(javascript:alert(1))", ...Array(255).fill(null)],
        }),
        makeSnap({
          id: "valid",
          svgDataUrl: "data:image/svg+xml,...",
        }),
      ],
    })
  );

  assert.equal(result.snaps.length, 1);
  assert.equal("svgDataUrl" in result.snaps[0], false);
  assert.equal(result.canPersist, false);
});
