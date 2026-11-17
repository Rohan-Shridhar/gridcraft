import test from "node:test";
import assert from "node:assert/strict";
import { createContributorsLoader } from "./contributors.mjs";

const people = [
  {
    login: "contributor",
    avatar_url: "https://example.test/avatar",
    html_url: "https://example.test/user",
  },
];
function makeStorage(value) {
  const entries = new Map(
    value === undefined ? [] : [["gridcraft:contributors", value]]
  );
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}
const response = (data = people) => new Response(JSON.stringify(data));

test("reuses a fresh session cache across loader instances", async () => {
  const storage = makeStorage();
  let calls = 0;
  const options = {
    storage,
    now: () => 1000,
    fetchImpl: async () => {
      calls++;
      return response();
    },
  };
  assert.deepEqual(await createContributorsLoader(options)(), people);
  assert.deepEqual(await createContributorsLoader(options)(), people);
  assert.equal(calls, 1);
});

test("refreshes at the five-minute boundary", async () => {
  const storage = makeStorage();
  let time = 1000,
    calls = 0;
  const load = createContributorsLoader({
    storage,
    now: () => time,
    fetchImpl: async () => {
      calls++;
      return response();
    },
  });
  await load();
  time += 5 * 60 * 1000 - 1;
  await load();
  assert.equal(calls, 1);
  time++;
  await load();
  assert.equal(calls, 2);
});

test("deduplicates overlapping requests", async () => {
  let resolve,
    calls = 0;
  const load = createContributorsLoader({
    storage: null,
    fetchImpl: () => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const first = load(),
    second = load();
  assert.equal(calls, 1);
  resolve(response());
  assert.deepEqual(await first, people);
  assert.deepEqual(await second, people);
});

test("caches an empty contributors list", async () => {
  let calls = 0;
  const load = createContributorsLoader({
    storage: makeStorage(),
    fetchImpl: async () => {
      calls++;
      return response([]);
    },
  });
  assert.deepEqual(await load(), []);
  assert.deepEqual(await load(), []);
  assert.equal(calls, 1);
});

test("ignores malformed and future-dated cache entries", async () => {
  for (const value of [
    "broken",
    "null",
    JSON.stringify({ timestamp: null, contributors: people }),
    JSON.stringify({ timestamp: 2000, contributors: people }),
    JSON.stringify({ timestamp: 1000, contributors: {} }),
  ]) {
    let calls = 0;
    const load = createContributorsLoader({
      storage: makeStorage(value),
      now: () => 1000,
      fetchImpl: async () => {
        calls++;
        return response();
      },
    });
    assert.deepEqual(await load(), people);
    assert.equal(calls, 1);
  }
});

test("loads contributors when storage throws on reads or writes", async () => {
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("quota");
    },
  };
  assert.deepEqual(
    await createContributorsLoader({
      storage,
      fetchImpl: async () => response(),
    })(),
    people
  );
});

test("distinguishes rate limits from other GitHub errors and allows retry", async () => {
  for (const [status, headers, rateLimited] of [
    [429, {}, true],
    [403, { "x-ratelimit-remaining": "0" }, true],
    [403, {}, false],
    [500, {}, false],
  ]) {
    let calls = 0;
    const load = createContributorsLoader({
      storage: makeStorage(),
      fetchImpl: async () =>
        ++calls === 1 ? new Response("", { status, headers }) : response(),
    });
    await assert.rejects(load(), (error) => error.rateLimited === rateLimited);
    assert.deepEqual(await load(), people);
    assert.equal(calls, 2);
  }
});

test("does not cache invalid API responses or network failures", async () => {
  for (const fail of [
    () => response({ message: "invalid" }),
    () => {
      throw Error("offline");
    },
  ]) {
    let calls = 0;
    const load = createContributorsLoader({
      storage: makeStorage(),
      fetchImpl: async () => (++calls === 1 ? fail() : response()),
    });
    await assert.rejects(load());
    assert.deepEqual(await load(), people);
    assert.equal(calls, 2);
  }
});
