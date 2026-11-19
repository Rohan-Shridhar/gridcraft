import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { MAX_SNAP_COUNT, SNAP_STORAGE_KEY, parseStoredSnaps, serializeStoredSnaps } from "../utils/snapStorage.mjs";

const window = new Window({ url: "http://localhost/" });
const globals = ["window", "document", "HTMLElement", "localStorage"];
const originals = new Map(
  globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);
for (const name of globals) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === "window" ? window : window[name],
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import("react-dom/client");
const { default: useSnaps } = await import("./useSnaps.js");

let root;
let host;

beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

after(() => {
  for (const [name, desc] of originals) {
    if (desc) Object.defineProperty(globalThis, name, desc);
    else delete globalThis[name];
  }
});

it("keeps duplicated snap titles within the 80-character storage limit", async () => {
  let snapsApi;
  function Harness() {
    snapsApi = useSnaps({
      cells: Array(16 * 16).fill(null),
      gridSize: 16,
      backgroundColor: "transparent",
      applySnapshot: () => {},
      showToast: () => {},
    });
    return null;
  }

  await act(async () => {
    root.render(createElement(Harness));
  });

  await act(async () => {
    snapsApi.createSnap();
  });

  const longTitle = "A".repeat(80);
  const firstId = snapsApi.snaps[0].id;

  await act(async () => {
    snapsApi.renameSnap(firstId, longTitle);
  });

  await act(async () => {
    snapsApi.duplicateSnap(firstId);
  });

  assert.equal(snapsApi.snaps.length, 2);
  assert.ok(snapsApi.snaps[1].title.length <= 80);
  assert.ok(snapsApi.snaps[1].title.endsWith(" copy"));

  const persisted = parseStoredSnaps(window.localStorage.getItem(SNAP_STORAGE_KEY));
  assert.equal(persisted.snaps.length, 2);
  assert.equal(persisted.notice, null);

  await act(async () => {
    root.unmount();
  });
  host.remove();
});

it("enforces MAX_SNAP_COUNT on createSnap and duplicateSnap so stored snaps remain persistable", async () => {
  const initialSnaps = Array.from({ length: MAX_SNAP_COUNT }, (_, i) => ({
    id: `snap-${i + 1}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    sequence: i + 1,
    title: `Snap ${i + 1}`,
    cells: Array(16 * 16).fill(null),
    gridSize: 16,
    backgroundColor: "transparent",
  }));
  window.localStorage.setItem(SNAP_STORAGE_KEY, serializeStoredSnaps(initialSnaps));

  let snapsApi;
  const toasts = [];
  function Harness() {
    snapsApi = useSnaps({
      cells: Array(16 * 16).fill(null),
      gridSize: 16,
      backgroundColor: "transparent",
      applySnapshot: () => {},
      showToast: (msg) => toasts.push(msg),
    });
    return null;
  }

  await act(async () => {
    root.render(createElement(Harness));
  });

  await act(async () => {
    snapsApi.createSnap();
  });

  await act(async () => {
    snapsApi.duplicateSnap("snap-1");
  });

  assert.equal(snapsApi.snaps.length, MAX_SNAP_COUNT);
  assert.deepEqual(toasts, [
    `A maximum of ${MAX_SNAP_COUNT} snaps can be stored`,
    `A maximum of ${MAX_SNAP_COUNT} snaps can be stored`,
  ]);

  const persisted = parseStoredSnaps(window.localStorage.getItem(SNAP_STORAGE_KEY));
  assert.equal(persisted.snaps.length, MAX_SNAP_COUNT);
  assert.equal(persisted.canPersist, true);

  await act(async () => {
    root.unmount();
  });
  host.remove();
});
