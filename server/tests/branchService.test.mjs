import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BranchService } from "../src/services/branchService.js";
import { assertSafeBranchName } from "../src/validators/branchValidator.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

describe("Branch GitHub operations", () => {
  it("creates a branch from the selected base branch", async () => {
    const calls = [];
    const service = new BranchService(async (url, options) => {
      calls.push({ url: new URL(url), options });
      if (url.endsWith("/repos/owner/repo")) {
        return response({ default_branch: "main" });
      }
      if (url.includes("/branches/feature%2Fbase")) {
        return response({ name: "feature/base", commit: { sha: "base-sha" } });
      }
      return response({ ref: "refs/heads/feature/new", object: { sha: "new-sha" } });
    });

    const result = await service.createBranch("token", "owner", "repo", {
      name: "feature/new",
      from: "feature/base",
    });

    assert.equal(result.sha, "new-sha");
    assert.equal(calls[1].url.pathname, "/repos/owner/repo/branches/feature%2Fbase");
    assert.deepEqual(JSON.parse(calls[2].options.body), {
      ref: "refs/heads/feature/new",
      sha: "base-sha",
    });
  });

  it("prevents deleting the actual default branch", async () => {
    let deleteRequested = false;
    const service = new BranchService(async (_url, options) => {
      if (options.method === "DELETE") deleteRequested = true;
      return response({ default_branch: "main" });
    });

    await assert.rejects(
      service.deleteBranch("token", "owner", "repo", "main"),
      (error) => error.status === 400
    );
    assert.equal(deleteRequested, false);
  });

  it("defaults createBranch base to repository default_branch when from is omitted and rejects invalid ref names", async () => {
    const calls = [];
    const service = new BranchService(async (url, options) => {
      calls.push({ url: new URL(url), options });
      if (url.endsWith("/repos/owner/repo")) {
        return response({ default_branch: "main" });
      }
      if (url.includes("/branches/main")) {
        return response({ name: "main", commit: { sha: "main-sha" } });
      }
      return response({ ref: "refs/heads/feature/default-base", object: { sha: "new-sha" } });
    });

    const result = await service.createBranch("token", "owner", "repo", {
      name: "feature/default-base",
    });

    assert.equal(result.sha, "new-sha");
    assert.equal(calls[1].url.pathname, "/repos/owner/repo/branches/main");

    for (const invalid of ["feature//double", "feature.", "-leading", ".hidden", "feature/.hidden", "feature.lock/sub"]) {
      assert.throws(() => assertSafeBranchName(invalid), (error) => error.status === 400);
    }
  });

  it("enforces max branch length, rejects no-op renames, and normalizes pagination in listBranches/listCommits", async () => {
    assert.throws(
      () => assertSafeBranchName("a".repeat(256)),
      (error) => error.status === 400
    );

    let renameCalled = false;
    const calls = [];
    const service = new BranchService(async (url, options) => {
      calls.push(new URL(url));
      if (options?.method === "POST") renameCalled = true;
      if (url.includes("/branches?")) {
        return response([{ name: "main", commit: { sha: "abc1234567" }, protected: false }]);
      }
      if (url.includes("/commits?")) {
        return response([{ sha: "abc1234567", commit: { message: "init", author: { name: "dev", date: "2026-01-01T00:00:00Z" } } }]);
      }
      return response({ default_branch: "main" });
    });

    await assert.rejects(
      () => service.renameBranch("token", "owner", "repo", "feature", { newName: "feature" }),
      (error) => error.status === 400
    );
    assert.equal(renameCalled, false);

    const branchList = await service.listBranches("token", "owner", "repo", { page: 0, perPage: 500 });
    assert.equal(branchList.page, 1);
    assert.equal(branchList.perPage, 100);
    assert.equal(calls[0].searchParams.get("page"), "1");
    assert.equal(calls[0].searchParams.get("per_page"), "100");

    await service.listCommits("token", "owner", "repo", "main", { page: Number.NaN, perPage: -5 });
    const commitCall = calls.find((u) => u.pathname.endsWith("/commits"));
    assert.equal(commitCall.searchParams.get("page"), "1");
    assert.equal(commitCall.searchParams.get("per_page"), "20");
  });
});
