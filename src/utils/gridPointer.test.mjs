import test from "node:test";
import assert from "node:assert/strict";
import { createGridPointerHandlers } from "./gridPointer.mjs";

function setup(options = {}) {
  const painted = [],
    hovered = [],
    captures = new Set();
  const cells = Array.from({ length: 4 }, (_, index) => ({
    dataset: { cellIndex: String(index) },
    closest() {
      return this;
    },
  }));
  let hit = cells[0];
  const grid = {
    contains: (cell) => cells.includes(cell),
    ownerDocument: { elementFromPoint: () => hit },
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const stroke = { pointerId: null, lastCell: null };
  const settings = {
    showGrid: true,
    isFill: false,
    paintCell: (index) => painted.push(index),
    onHover: (index) => hovered.push(index),
    ...options,
  };
  const handlers = createGridPointerHandlers(stroke, settings);
  const event = (extra = {}) => ({
    currentTarget: grid,
    target: cells[0],
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...extra,
  });
  return {
    painted,
    hovered,
    captures,
    cells,
    stroke,
    settings,
    handlers,
    event,
    hit: (value) => {
      hit = value;
    },
  };
}

for (const pointerType of ["mouse", "touch", "pen"]) {
  test(`${pointerType} paints across captured cells without repeating the same cell`, () => {
    const s = setup();
    s.handlers.onPointerDown(s.event({ pointerType }));
    assert.ok(s.captures.has(1));
    s.hit(s.cells[1]);
    s.handlers.onPointerMove(s.event({ pointerType }));
    s.handlers.onPointerMove(s.event({ pointerType }));
    s.hit(s.cells[2]);
    s.handlers.onPointerMove(s.event({ pointerType }));
    s.handlers.onPointerUp(s.event({ pointerType }));
    s.hit(s.cells[3]);
    s.handlers.onPointerMove(s.event({ pointerType }));
    assert.deepEqual(s.painted, [0, 1, 2]);
    assert.equal(s.captures.size, 0);
  });
}

for (const finish of ["onPointerCancel", "onLostPointerCapture"]) {
  test(`${finish} ends a stroke`, () => {
    const s = setup();
    s.handlers.onPointerDown(s.event());
    s.handlers[finish](s.event());
    s.hit(s.cells[1]);
    s.handlers.onPointerMove(s.event());
    assert.deepEqual(s.painted, [0]);
    assert.equal(s.captures.size, 0);
  });
}

test("fill paints only on the initial press", () => {
  const s = setup({ isFill: true });
  s.handlers.onPointerDown(s.event());
  s.hit(s.cells[1]);
  s.handlers.onPointerMove(s.event());
  assert.deepEqual(s.painted, [0]);
});

test("preview does not paint or capture a pointer", () => {
  const s = setup({ showGrid: false });
  s.handlers.onPointerDown(s.event());
  s.handlers.onPointerMove(s.event());
  assert.deepEqual(s.painted, []);
  assert.equal(s.captures.size, 0);
});

test("secondary pointers and non-primary buttons cannot paint or replace a stroke", () => {
  const s = setup();
  s.handlers.onPointerDown(s.event({ isPrimary: false }));
  s.handlers.onPointerDown(s.event({ button: 2 }));
  assert.deepEqual(s.painted, []);
  s.handlers.onPointerDown(s.event());
  s.handlers.onPointerDown(s.event({ pointerId: 2 }));
  s.hit(s.cells[1]);
  s.handlers.onPointerMove(s.event({ pointerId: 2 }));
  s.handlers.onPointerUp(s.event({ pointerId: 2 }));
  assert.ok(s.captures.has(1));
  s.handlers.onPointerMove(s.event());
  assert.deepEqual(s.painted, [0, 1]);
});

test("leaving the canvas does not paint outside it or lose the captured stroke", () => {
  const s = setup();
  s.handlers.onPointerDown(s.event());
  s.hit(null);
  s.handlers.onPointerMove(s.event());
  s.handlers.onPointerLeave();
  assert.equal(s.hovered.at(-1), null);
  s.hit(s.cells[0]);
  s.handlers.onPointerMove(s.event());
  s.hit({
    dataset: { cellIndex: "3" },
    closest() {
      return this;
    },
  });
  s.handlers.onPointerMove(s.event());
  s.hit(s.cells[1]);
  s.handlers.onPointerMove(s.event());
  assert.deepEqual(s.painted, [0, 1]);
});

test("a re-render preserves the stroke and uses the latest tool state", () => {
  const s = setup();
  s.handlers.onPointerDown(s.event());
  s.hit(s.cells[1]);
  createGridPointerHandlers(s.stroke, {
    ...s.settings,
    isFill: true,
  }).onPointerMove(s.event());
  assert.deepEqual(s.painted, [0]);
  createGridPointerHandlers(s.stroke, s.settings).onPointerMove(s.event());
  assert.deepEqual(s.painted, [0, 1]);
});

test("cells with empty, non-numeric, negative, or non-integer data-cell-index are ignored", () => {
  for (const rawIndex of ["", "   ", "abc", "-1", "1.5"]) {
    const s = setup();
    s.cells[0].dataset.cellIndex = rawIndex;
    s.handlers.onPointerDown(s.event({ target: s.cells[0] }));
    assert.deepEqual(s.painted, []);
    assert.deepEqual(s.hovered, []);
    assert.equal(s.captures.size, 0);

    s.hit(s.cells[0]);
    s.handlers.onPointerMove(s.event());
    assert.deepEqual(s.painted, []);
    assert.deepEqual(s.hovered, [null]);
  }
});
