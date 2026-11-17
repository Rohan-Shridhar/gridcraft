import test from "node:test";
import assert from "node:assert/strict";
import { getHistoryShortcut } from "./historyShortcuts.mjs";

for (const [name, event, expected] of [
  ["Ctrl+Z", { key: "z", ctrlKey: true }, "undo"],
  ["Cmd+Z", { key: "z", metaKey: true }, "undo"],
  ["Ctrl+Shift+Z", { key: "Z", ctrlKey: true, shiftKey: true }, "redo"],
  ["Cmd+Shift+Z", { key: "Z", metaKey: true, shiftKey: true }, "redo"],
  ["Ctrl+Y", { key: "y", ctrlKey: true }, "redo"],
  ["Cmd+Y", { key: "y", metaKey: true }, "redo"],
  ["plain Z", { key: "z" }, null],
  ["plain Y", { key: "y" }, null],
  ["Shift+Z", { key: "Z", shiftKey: true }, null],
  ["another command", { key: "b", ctrlKey: true }, null],
]) {
  test(name, () => assert.equal(getHistoryShortcut(event), expected));
}
