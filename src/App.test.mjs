import test, { before, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { act, createElement, StrictMode } from "react";
import { createServer } from "vite";

const window = new Window({ url: "http://localhost/editor" });
const globals = [
  "window",
  "document",
  "HTMLElement",
  "localStorage",
  "sessionStorage",
  "FileReader",
  "Image",
];
const originals = new Map(
  globals.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
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
const originalFetch = globalThis.fetch;
let server;
let App;
let ArtworkEditor;
let root;
let host;
let grid;
let cells;
let hit;

before(
  async () => {
    server = await createServer({
      root: fileURLToPath(new URL("../", import.meta.url)),
      server: { middlewareMode: true },
      optimizeDeps: { noDiscovery: true, include: [] },
      logLevel: "error",
    });
    globalThis.fetch = async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const api = (await server.ssrLoadModule("/src/services/apiClient.js"))
      .default;
    api.getCurrentUser = async () => ({ authenticated: false });
    api.getArtwork = async () => ({
      sha: "initial",
      artwork: {
        name: "Test artwork",
        gridSize: 16,
        backgroundColor: "transparent",
        cells: Array(256).fill(null),
      },
    });
    api.getArtworkHistory = async () => ({ commits: [] });
    App = (await server.ssrLoadModule("/src/App.jsx")).default;
    ArtworkEditor = (
      await server.ssrLoadModule("/src/components/ArtworkEditor.jsx")
    ).default;
  },
  { timeout: 30000 },
);

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(createElement(StrictMode, null, createElement(App))),
  );
  grid = document.getElementById("pixel-grid");
  cells = [...grid.querySelectorAll("[data-cell-index]")];
  let captured = null;
  grid.setPointerCapture = (id) => {
    captured = id;
  };
  grid.hasPointerCapture = (id) => captured === id;
  grid.releasePointerCapture = () => {
    captured = null;
  };
  document.elementFromPoint = () => hit;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
  await window.happyDOM.close();
  for (const name of globals) {
    const descriptor = originals.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function pointer(target, type) {
  target.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
    }),
  );
}

async function stroke(indices) {
  await act(async () => {
    pointer(cells[indices[0]], "pointerdown");
    for (const index of indices.slice(1)) {
      hit = cells[index];
      pointer(grid, "pointermove");
    }
    pointer(grid, "pointerup");
  });
}

async function historyKey(shiftKey = false, modifier = "ctrlKey") {
  await act(async () =>
    document.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "z",
        [modifier]: true,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
}

function colors(count) {
  return cells.slice(0, count).map((cell) => cell.style.backgroundColor);
}

test("retains every cell and undo step in a batched pointer stroke", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await stroke([0, 1, 2]);
  assert.deepEqual(colors(3), ["#e63946", "#e63946", "#e63946"]);
  await historyKey();
  assert.deepEqual(colors(3), ["#e63946", "#e63946", "transparent"]);
  await historyKey();
  assert.deepEqual(colors(3), ["#e63946", "transparent", "transparent"]);
  await historyKey();
  assert.deepEqual(colors(3), ["transparent", "transparent", "transparent"]);
  await historyKey(true);
  assert.deepEqual(colors(3), ["#e63946", "transparent", "transparent"]);
});

test("does not add another history step when a stroke revisits an unchanged cell", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await stroke([0, 1, 0]);
  assert.deepEqual(colors(2), ["#e63946", "#e63946"]);
  await historyKey();
  assert.deepEqual(colors(2), ["#e63946", "transparent"]);
  await historyKey();
  assert.deepEqual(colors(2), ["transparent", "transparent"]);
  assert.equal(document.querySelector('[aria-label="Undo"]').disabled, true);
});

async function toolKey(key, modifiers = {}) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    ...modifiers,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => document.dispatchEvent(event));
  assert.equal(event.defaultPrevented, false);
}

for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
  test(`guest editor leaves ${modifier} shortcuts to the browser`, async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const originalConfirm = window.confirm;
    const confirm = context.mock.fn(() => true);
    window.confirm = confirm;
    context.after(() => {
      window.confirm = originalConfirm;
    });
    await stroke([0]);
    const before = colors(cells.length);

    await toolKey("c", { [modifier]: true });
    assert.deepEqual(colors(cells.length), before);
    await toolKey("d", { [modifier]: true });
    assert.equal(confirm.mock.callCount(), 0);
    assert.deepEqual(colors(cells.length), before);
    for (const key of ["e", "b"]) {
      await toolKey(key, { [modifier]: true });
      assert.equal(
        document
          .querySelector('[aria-label="Eraser"]')
          .getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(
        document
          .querySelector('[aria-label="Fill"]')
          .getAttribute("aria-pressed"),
        "false",
      );
    }
  });

  test(`artwork editor leaves ${modifier} shortcuts to the browser`, async () => {
    await act(async () =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(ArtworkEditor, {
            owner: "owner",
            repoName: "album",
            storyId: "story",
            artworkId: "artwork",
            onDirtyChange() {},
            showToast() {},
          }),
        ),
      ),
    );
    await toolKey("e");
    const eraser = () =>
      document
        .querySelector('[aria-label="Eraser"]')
        .getAttribute("aria-pressed");
    assert.equal(eraser(), "true");
    for (const key of ["b", "a", "e"]) {
      await toolKey(key, { [modifier]: true });
      assert.equal(eraser(), "true");
      assert.equal(
        document
          .querySelector('[aria-label="Fill"]')
          .getAttribute("aria-pressed"),
        "false",
      );
    }
    if (modifier !== "altKey") {
      await toolKey("a");
      const cell = document.querySelector('[data-cell-index="0"]');
      await act(async () =>
        cell.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      assert.equal(cell.style.backgroundColor, "#e63946");
      await historyKey(false, modifier);
      assert.equal(cell.style.backgroundColor, "transparent");
      await historyKey(true, modifier);
      assert.equal(cell.style.backgroundColor, "#e63946");
    }
  });
}

test("guest editor still fills and clears with unmodified shortcuts", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const originalConfirm = window.confirm;
  const confirm = context.mock.fn(() => true);
  window.confirm = confirm;
  context.after(() => {
    window.confirm = originalConfirm;
  });

  await toolKey("c");
  assert.ok(colors(cells.length).every((color) => color === "#e63946"));
  await toolKey("d");
  assert.equal(confirm.mock.callCount(), 1);
  assert.ok(colors(cells.length).every((color) => color === "transparent"));
});
