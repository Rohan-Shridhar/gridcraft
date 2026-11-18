import assert from "node:assert/strict";
import { test } from "node:test";
import { getGridNavigationIndex } from "./gridKeyboard.mjs";

for (const size of [16, 32, 64, 128]) {
  test(`${size} by ${size} arrow navigation stays within rows and columns`, () => {
    assert.equal(getGridNavigationIndex(0, "ArrowLeft", size), 0);
    assert.equal(
      getGridNavigationIndex(size - 1, "ArrowRight", size),
      size - 1
    );
    assert.equal(getGridNavigationIndex(1, "ArrowUp", size), 1);
    assert.equal(
      getGridNavigationIndex(size * size - 2, "ArrowDown", size),
      size * size - 2
    );
    assert.equal(getGridNavigationIndex(size + 1, "ArrowLeft", size), size);
    assert.equal(getGridNavigationIndex(size, "ArrowRight", size), size + 1);
    assert.equal(getGridNavigationIndex(size + 1, "ArrowUp", size), 1);
    assert.equal(getGridNavigationIndex(1, "ArrowDown", size), size + 1);
  });

  test(`${size} by ${size} Home and End support row and whole-grid navigation`, () => {
    assert.equal(getGridNavigationIndex(size + 1, "Home", size), size);
    assert.equal(getGridNavigationIndex(size + 1, "End", size), size * 2 - 1);
    assert.equal(getGridNavigationIndex(size + 1, "Home", size, true), 0);
    assert.equal(
      getGridNavigationIndex(size + 1, "End", size, true),
      size * size - 1
    );
  });
}

test("other keys and modified arrows remain available to other handlers", () => {
  assert.equal(getGridNavigationIndex(0, "a", 16), null);
  assert.equal(getGridNavigationIndex(0, "Tab", 16), null);
  assert.equal(getGridNavigationIndex(0, "ArrowRight", 16, true), null);
});
