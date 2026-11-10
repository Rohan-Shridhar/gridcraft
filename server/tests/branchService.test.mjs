import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BranchService } from "../src/services/branchService.js";

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
});
