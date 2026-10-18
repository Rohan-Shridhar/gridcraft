import assert from "node:assert/strict";
import test from "node:test";
import {
  createSnapSvgData,
  SUPPORTED_GRID_SIZES,
} from "./snapSvg.mjs";

function createSnap(gridSize, cells, backgroundColor = "transparent") {
  return { gridSize, cells, backgroundColor };
}

test("creates an empty transparent snapshot without pixel rectangles", () => {
  const gridSize = 16;
  const svgData = createSnapSvgData(
    createSnap(gridSize, Array(gridSize * gridSize).fill(null))
  );

  assert.equal(svgData.viewBox, "0 0 16 16");
  assert.equal(svgData.backgroundFill, null);
  assert.deepEqual(svgData.rectangles, []);
});

test("preserves transparent cells and draws only saved non-transparent colors", () => {
  const cells = Array(16 * 16).fill(null);
  cells[0] = "#e63946";
  cells[1] = "#e63946";
  cells[16] = "#e63946";

  const svgData = createSnapSvgData(createSnap(16, cells, "#ffffff"));

  assert.equal(svgData.backgroundFill, "#ffffff");
  assert.deepEqual(svgData.rectangles, [
    { x: 0, y: 0, width: 2, height: 1, fill: "#e63946" },
    { x: 0, y: 1, width: 1, height: 1, fill: "#e63946" },
  ]);
});

test("groups same-color adjacent runs without crossing pixel colors", () => {
  const cells = Array(16 * 16).fill(null);
  cells.splice(0, 4, "#abc", "#abc", "#123456", "#123456");
  cells.splice(16, 4, "#abc", "#abc", "#123456", "#123456");

  const svgData = createSnapSvgData(createSnap(16, cells));

  assert.deepEqual(svgData.rectangles, [
    { x: 0, y: 0, width: 2, height: 2, fill: "#abc" },
    { x: 2, y: 0, width: 2, height: 2, fill: "#123456" },
  ]);
});

test("supports every grid size and merges a solid canvas into one rectangle", () => {
  for (const gridSize of SUPPORTED_GRID_SIZES) {
    const color = "#12abEF";
    const svgData = createSnapSvgData(
      createSnap(gridSize, Array(gridSize * gridSize).fill(color))
    );

    assert.equal(svgData.viewBox, `0 0 ${gridSize} ${gridSize}`);
    assert.deepEqual(svgData.rectangles, [
      { x: 0, y: 0, width: gridSize, height: gridSize, fill: color },
    ]);
  }
});

test("returns null for malformed dimensions, cells, colors, and backgrounds", () => {
  const validCells = Array(16 * 16).fill(null);
  const malformedSnapshots = [
    null,
    [],
    createSnap(15, Array(15 * 15).fill(null)),
    createSnap(16, validCells.slice(1)),
    createSnap(16, [undefined, ...validCells.slice(1)]),
    createSnap(16, ["url(javascript:alert(1))", ...validCells.slice(1)]),
    createSnap(16, validCells, "url(javascript:alert(1))"),
    createSnap(16, validCells, null),
  ];

  for (const snap of malformedSnapshots) {
    assert.equal(createSnapSvgData(snap), null);
  }
});
