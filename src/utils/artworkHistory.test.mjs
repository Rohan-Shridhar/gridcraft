import test from "node:test";
import assert from "node:assert/strict";
import {
  artworkHistoryReducer as update,
  createArtworkHistory,
} from "./artworkHistory.mjs";

test("each paint has exactly one undo and redo step", () => {
  let state = createArtworkHistory([null, null]);
  state = update(state, { type: "paint", index: 0, color: "red" });
  state = update(state, { type: "paint", index: 1, color: "blue" });
  assert.equal(state.history.length, 2);
  state = update(state, { type: "undo" });
  assert.deepEqual(state.cells, ["red", null]);
  state = update(state, { type: "undo" });
  assert.deepEqual(state.cells, [null, null]);
  assert.equal(state.history.length, 0);
  assert.equal(state.future.length, 2);
  state = update(state, { type: "redo" });
  assert.deepEqual(state.cells, ["red", null]);
  state = update(state, { type: "redo" });
  assert.deepEqual(state.cells, ["red", "blue"]);
  assert.equal(state.future.length, 0);
  assert.equal(state.history.length, 2);
});

test("replaying a transition does not mutate the input or duplicate history", () => {
  const state = createArtworkHistory([null]);
  Object.freeze(state.cells);
  Object.freeze(state.history);
  Object.freeze(state.future);
  Object.freeze(state);
  const action = { type: "paint", index: 0, color: "red" };
  assert.deepEqual(update(state, action), update(state, action));
  assert.deepEqual(state, { cells: [null], history: [], future: [] });
  const painted = update(state, action);
  for (const type of ["undo", "clear", "replace", "resetHistory"]) {
    const nextAction = { type, cells: ["blue"] };
    const original = structuredClone(painted);
    assert.deepEqual(update(painted, nextAction), update(painted, nextAction));
    assert.deepEqual(painted, original);
  }
  const undone = update(painted, { type: "undo" });
  assert.deepEqual(
    update(undone, { type: "redo" }),
    update(undone, { type: "redo" })
  );
  assert.equal(undone.history.length, 0);
  assert.equal(undone.future.length, 1);
});

test("unchanged paint and unavailable history actions preserve state", () => {
  const state = createArtworkHistory(["red"]);
  assert.equal(update(state, { type: "paint", index: 0, color: "red" }), state);
  assert.equal(update(state, { type: "undo" }), state);
  assert.equal(update(state, { type: "redo" }), state);
});

test("a new edit after undo discards the redo branch", () => {
  let state = createArtworkHistory([null]);
  state = update(state, { type: "paint", index: 0, color: "red" });
  state = update(state, { type: "undo" });
  state = update(state, { type: "paint", index: 0, color: "blue" });
  assert.equal(state.future.length, 0);
  assert.deepEqual(update(state, { type: "undo" }).cells, [null]);
});

test("bulk replacement and clearing retain independent undo snapshots", () => {
  let state = createArtworkHistory(["red", null]);
  const replacement = ["blue", "green"];
  state = update(state, { type: "replace", cells: replacement });
  replacement[0] = "black";
  assert.deepEqual(state.cells, ["blue", "green"]);
  state = update(state, { type: "clear" });
  assert.deepEqual(state.cells, [null, null]);
  state = update(state, { type: "undo" });
  assert.deepEqual(state.cells, ["blue", "green"]);
  state = update(state, { type: "undo" });
  assert.deepEqual(state.cells, ["red", null]);
});

test("history retains only the latest fifteen edits", () => {
  let state = createArtworkHistory([null]);
  for (let color = 0; color < 20; color++) {
    state = update(state, { type: "paint", index: 0, color });
  }
  assert.equal(state.history.length, 15);
  for (let i = 0; i < 15; i++) state = update(state, { type: "undo" });
  assert.deepEqual(state.cells, [4]);
  assert.equal(state.future.length, 15);
  for (let i = 0; i < 15; i++) state = update(state, { type: "redo" });
  assert.deepEqual(state.cells, [19]);
  assert.equal(state.history.length, 15);
});

test("loading or resizing resets history while saving preserves the canvas", () => {
  let state = createArtworkHistory([null]);
  state = update(state, { type: "paint", index: 0, color: "red" });
  const saved = update(state, { type: "resetHistory" });
  assert.deepEqual(saved, { cells: ["red"], history: [], future: [] });
  const cells = ["blue", null];
  const loaded = update(state, { type: "reset", cells });
  cells[0] = "black";
  assert.deepEqual(loaded, { cells: ["blue", null], history: [], future: [] });
});
test("flood fill uses the current canvas after a queued paint", () => {
  let state = createArtworkHistory([null, null, null, null]);
  state = update(state, { type: "paint", index: 0, color: "red" });
  state = update(state, { type: "fill", index: 0, color: "blue", gridSize: 2 });
  assert.deepEqual(state.cells, ["blue", null, null, null]);
  assert.deepEqual(update(state, { type: "undo" }).cells, [
    "red",
    null,
    null,
    null,
  ]);
  assert.equal(state.history.length, 2);
});

test("flood fill respects connected regions and row boundaries", () => {
  const original = [null, "wall", null, null, "wall", null, null, "wall", null];
  const state = createArtworkHistory(original);
  const filled = update(state, {
    type: "fill",
    index: 3,
    color: "blue",
    gridSize: 3,
  });
  assert.deepEqual(filled.cells, [
    "blue",
    "wall",
    null,
    "blue",
    "wall",
    null,
    "blue",
    "wall",
    null,
  ]);
  assert.deepEqual(update(filled, { type: "undo" }).cells, original);
  assert.deepEqual(state.cells, original);
});

test("filling an unchanged region preserves history", () => {
  const state = createArtworkHistory(Array(9).fill("red"));
  assert.equal(
    update(state, { type: "fill", index: 4, color: "red", gridSize: 3 }),
    state
  );
});

test("filling empty cells retains preceding paint and its undo snapshot", () => {
  let state = createArtworkHistory(["red", null, null, "wall"]);
  state = update(state, { type: "paint", index: 1, color: "green" });
  state = update(state, { type: "fillEmpty", color: "blue" });
  assert.deepEqual(state.cells, ["red", "green", "blue", "wall"]);
  assert.deepEqual(update(state, { type: "undo" }).cells, [
    "red",
    "green",
    null,
    "wall",
  ]);
});

test("out-of-bounds paint/fill and no-op clear/fillEmpty preserve state and redo history", () => {
  const empty = createArtworkHistory([null, null, null, null]);
  assert.equal(update(empty, { type: "clear" }), empty);
  assert.equal(update(empty, { type: "paint", index: -1, color: "red" }), empty);
  assert.equal(update(empty, { type: "paint", index: 4, color: "red" }), empty);
  assert.equal(update(empty, { type: "fill", index: -1, color: "red", gridSize: 2 }), empty);
  assert.equal(update(empty, { type: "fill", index: 4, color: "red", gridSize: 2 }), empty);

  const full = createArtworkHistory(["red", "red", "red", "red"]);
  assert.equal(update(full, { type: "fillEmpty", color: "blue" }), full);
});
