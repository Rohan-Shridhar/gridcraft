import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { it } from "node:test";
import { AppStore } from "../src/services/appStore.js";

for (const operation of ["initialize", "write", "timeout"]) {
  const description = operation === "timeout"
    ? "fails when a SQLite lock outlasts the busy timeout"
    : `waits for a temporary SQLite lock during ${operation}`;
  it(description, async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "gridcraft-store-"));
    const databasePath = path.join(directory, "store.sqlite");
    let store;
    let worker;

    try {
      if (operation !== "initialize") store = new AppStore(databasePath);
      worker = new Worker(`
        const { parentPort, workerData } = require("node:worker_threads");
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(workerData);
        db.exec("BEGIN IMMEDIATE");
        parentPort.postMessage("locked");
        parentPort.once("message", () => {
          setTimeout(() => {
            db.exec("ROLLBACK");
            db.close();
            parentPort.close();
          }, 200);
        });
      `, { eval: true, workerData: databasePath });
      const finished = once(worker, "exit");
      await once(worker, "message");
      if (operation === "timeout") {
        assert.throws(
          () => store.upsertUser({ id: 1, login: "artist", name: "Artist" }),
          { code: "ERR_SQLITE_ERROR", errcode: 5 }
        );
        return;
      }
      worker.postMessage("release");

      if (operation === "initialize") store = new AppStore(databasePath);
      const user = store.upsertUser({ id: 1, login: "artist", name: "Artist" });
      assert.equal(user.login, "artist");
      assert.deepEqual(await finished, [0]);
    } finally {
      if (worker) await worker.terminate();
      store?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
