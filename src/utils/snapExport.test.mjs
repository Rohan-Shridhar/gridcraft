import assert from "node:assert/strict";
import test from "node:test";
import {
  createSnapExportData,
  MAX_IMPORTED_SNAPS,
  SNAP_EXPORT_FORMAT,
  SNAP_EXPORT_VERSION,
  validateSnapExport,
} from "./snapExport.mjs";

function makeSnap(gridSize = 16) {
  return {
    id: `snap-${gridSize}`,
    createdAt: "2026-10-18T00:00:00.000Z",
    sequence: 1,
    title: "Test snap",
    cells: Array(gridSize * gridSize).fill(null),
    gridSize,
    backgroundColor: "transparent",
    caption: "",
    notes: "",
    includedInPresentation: true,
    durationMs: 1500,
  };
}

test("validates supported exported snapshots and keeps metadata", () => {
  for (const gridSize of [16, 32, 64, 128]) {
    const data = {
      format: SNAP_EXPORT_FORMAT,
      version: SNAP_EXPORT_VERSION,
      snaps: [makeSnap(gridSize)],
    };
    const result = validateSnapExport(data);
    assert.equal(result.valid, true);
    assert.equal(result.snaps[0].gridSize, gridSize);
  }
});

test("rejects malformed schemas, cells, colors, and duplicate identifiers", () => {
  const valid = makeSnap();
  const malformed = [
    null,
    [],
    { format: "other", version: 1, snaps: [] },
    { format: SNAP_EXPORT_FORMAT, version: 2, snaps: [] },
    { format: SNAP_EXPORT_FORMAT, version: 1, snaps: [null] },
    {
      format: SNAP_EXPORT_FORMAT,
      version: 1,
      snaps: [{ ...valid, cells: valid.cells.slice(1) }],
    },
    {
      format: SNAP_EXPORT_FORMAT,
      version: 1,
      snaps: [{ ...valid, cells: ["url(javascript:alert(1))", ...valid.cells.slice(1)] }],
    },
    {
      format: SNAP_EXPORT_FORMAT,
      version: 1,
      snaps: [{ ...valid, backgroundColor: "url(javascript:alert(1))" }],
    },
    {
      format: SNAP_EXPORT_FORMAT,
      version: 1,
      snaps: [valid, { ...valid }],
    },
  ];

  for (const data of malformed) {
    assert.equal(validateSnapExport(data).valid, false);
  }
});

test("rejects imports exceeding the reasonable snapshot count limit", () => {
  const snaps = Array.from({ length: MAX_IMPORTED_SNAPS + 1 }, (_, index) => ({
    ...makeSnap(),
    id: `snap-${index}`,
  }));
  assert.equal(
    validateSnapExport({
      format: SNAP_EXPORT_FORMAT,
      version: SNAP_EXPORT_VERSION,
      snaps,
    }).valid,
    false
  );
});

test("creates a JSON export copy without sharing pixel arrays", () => {
  const snap = makeSnap();
  const result = createSnapExportData([snap]);
  assert.equal(result.format, SNAP_EXPORT_FORMAT);
  assert.equal(result.version, SNAP_EXPORT_VERSION);
  assert.notEqual(result.snaps[0].cells, snap.cells);
  assert.deepEqual(result.snaps[0].cells, snap.cells);
});

test("strips unknown properties, normalizes defaults, and rejects whitespace-only ids on import", () => {
  const rawSnap = makeSnap();
  delete rawSnap.caption;
  delete rawSnap.notes;
  delete rawSnap.includedInPresentation;
  delete rawSnap.durationMs;
  rawSnap.unexpectedField = "drop-me";

  const validRes = validateSnapExport({
    format: SNAP_EXPORT_FORMAT,
    version: SNAP_EXPORT_VERSION,
    snaps: [rawSnap],
  });
  assert.equal(validRes.valid, true);
  assert.equal("unexpectedField" in validRes.snaps[0], false);
  assert.equal(validRes.snaps[0].caption, "");
  assert.equal(validRes.snaps[0].notes, "");
  assert.equal(validRes.snaps[0].includedInPresentation, true);
  assert.equal(validRes.snaps[0].durationMs, 1500);
  assert.notEqual(validRes.snaps[0].cells, rawSnap.cells);

  const blankIdRes = validateSnapExport({
    format: SNAP_EXPORT_FORMAT,
    version: SNAP_EXPORT_VERSION,
    snaps: [{ ...makeSnap(), id: "   " }],
  });
  assert.equal(blankIdRes.valid, false);
});
