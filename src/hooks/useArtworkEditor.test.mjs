import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, createElement, StrictMode } from "react";
import apiClient from "../services/apiClient.js";
import useArtworkEditor from "./useArtworkEditor.js";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const originalApi = { ...apiClient };
const originalArtwork = {
  name: "Sample",
  gridSize: 16,
  backgroundColor: "transparent",
  cells: Array(256).fill(null),
};
let editor;
let root;

function Harness() {
  editor = useArtworkEditor();
  return null;
}

beforeEach(async () => {
  apiClient.getArtwork = async () => ({
    sha: "initial-sha",
    artwork: structuredClone(originalArtwork),
  });
  for (const method of ["saveArtwork", "createArtwork", "renameArtwork"]) {
    apiClient[method] = async () => {
      throw new Error("Unexpected write");
    };
  }
  root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(createElement(StrictMode, null, createElement(Harness)))
  );
  await act(async () =>
    editor.loadArtwork("owner", "album", "story", "artwork")
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  Object.assign(apiClient, originalApi);
});

after(async () => {
  await window.happyDOM.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function startWrite(operation) {
  const method = {
    save: "saveArtwork",
    saveAsNew: "createArtwork",
    rename: "renameArtwork",
  }[operation];
  let resolve;
  let reject;
  let payload;
  let calls = 0;
  apiClient[method] = (...args) => {
    calls += 1;
    payload = args[operation === "saveAsNew" ? 3 : 4];
    return new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
  };
  let pending;
  await act(async () => {
    pending = editor[operation]("Copy");
  });
  return {
    get calls() {
      return calls;
    },
    async complete(edit) {
      const artwork =
        operation === "rename"
          ? { ...structuredClone(originalArtwork), name: "Copy" }
          : { ...structuredClone(payload), id: "copy" };
      await act(async () => {
        edit?.();
        resolve({ sha: "updated-sha", artworkId: "copy", artwork });
        await pending;
      });
    },
    async fail() {
      await act(async () => {
        reject(new Error("Write failed"));
        await assert.rejects(pending, /Write failed/);
      });
    },
  };
}

const edits = {
  paint: () => editor.paintCell(1, "blue"),
  replace: () => editor.setCellsBulk(Array(256).fill("blue")),
  clear: () => editor.clearCanvas(),
  resize: () => editor.changeGridSize(32),
  background: () => editor.updateBackgroundColor("#123456"),
  undo: () => editor.undo(),
  redo: () => editor.redo(),
};

for (const operation of ["save", "saveAsNew", "rename"]) {
  for (const [name, edit] of Object.entries(edits)) {
    test(`${operation} retains edits made during the request: ${name}`, async () => {
      await act(async () => editor.paintCell(0, "red"));
      if (name === "redo") await act(async () => editor.undo());
      const write = await startWrite(operation);
      await act(async () => edit());
      const expected = {
        cells: [...editor.cells],
        size: editor.gridSize,
        background: editor.backgroundColor,
        history: editor.history.length,
        future: editor.future.length,
      };
      assert.equal(editor.saveState, "saving");
      await write.complete();
      assert.equal(editor.isDirty, true);
      assert.equal(editor.saveState, "unsaved");
      assert.deepEqual(editor.cells, expected.cells);
      assert.equal(editor.gridSize, expected.size);
      assert.equal(editor.backgroundColor, expected.background);
      assert.equal(editor.history.length, expected.history);
      assert.equal(editor.future.length, expected.future);
      assert.equal(editor.shaRef.current, "updated-sha");
    });
  }

  test(`${operation} marks the snapshot saved when no newer edits exist`, async () => {
    const write = await startWrite(operation);
    await write.complete();
    assert.equal(editor.isDirty, false);
    assert.equal(editor.saveState, "saved");
  });

  test(`${operation} retains an edit batched with the write response`, async () => {
    const write = await startWrite(operation);
    await write.complete(() => editor.setCellsBulk(Array(256).fill("blue")));
    assert.equal(editor.isDirty, true);
    assert.equal(editor.saveState, "unsaved");
    assert.equal(editor.cells[0], "blue");
  });
  test(`${operation} prevents overlapping writes`, async () => {
    const write = await startWrite(operation);
    await act(async () => {
      for (const next of ["save", "saveAsNew", "rename"]) {
        editor[next]("Other")?.catch(() => {});
      }
    });
    assert.equal(write.calls, 1);
    assert.equal(editor.saveState, "saving");
    await write.complete();
  });

  test(`${operation} releases the write guard after failure and allows retry`, async () => {
    const write = await startWrite(operation);
    await act(async () => editor.setCellsBulk(Array(256).fill("blue")));
    await write.fail();
    assert.equal(editor.isDirty, true);
    assert.equal(editor.saveState, "error");
    const retry = await startWrite(operation);
    assert.equal(retry.calls, 1);
    assert.equal(editor.saveState, "saving");
    await retry.complete();
    assert.equal(editor.isDirty, operation === "rename");
  });
}
