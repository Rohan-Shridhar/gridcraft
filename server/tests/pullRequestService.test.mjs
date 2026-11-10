import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PullRequestService } from "../src/services/pullRequestService.js";

function response(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function pull(overrides = {}) {
  return {
    number: 12,
    title: "Update artwork",
    body: "A change",
    state: "open",
    merged: false,
    mergeable: true,
    mergeable_state: "clean",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    user: { login: "contributor", avatar_url: "https://avatars.example/contributor.png" },
    base: { ref: "master", sha: "base-sha", repo: { full_name: "owner/repo" } },
    head: { ref: "feature/art", sha: "head-sha", repo: { full_name: "artist/repo" } },
    ...overrides,
  };
}

describe("Pull request GitHub operations", () => {
  it("creates a fork-based pull request with a validated head branch and master base", async () => {
    let requestBody;
    const service = new PullRequestService(async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response(pull());
    });

    const result = await service.createPull("token", "owner", "repo", {
      title: "Update artwork",
      head: "feature/art",
      headRepo: "artist/repo",
    });

    assert.equal(requestBody.head, "artist:feature/art");
    assert.equal(requestBody.base, "master");
    assert.equal(result.pull.head.repo, "artist/repo");
    await assert.rejects(
      service.createPull("token", "owner", "repo", {
        title: "Bad branch",
        head: "../private",
      }),
      (error) => error.status === 400
    );
    await assert.rejects(
      service.createPull("token", "owner", "repo", {
        title: "Bad repository",
        head: "branch",
        headRepo: "not-a-full-repository",
      })
    );
  });

  it("loads real conversation, review, commit, file, merge method, and permission data", async () => {
    const service = new PullRequestService(async (url) => {
      if (url.endsWith("/pulls/12")) return response(pull());
      if (url.includes("/issues/12/comments")) {
        return response([{ id: 2, body: "Looks good", created_at: "2026-01-03T00:00:00Z", user: { login: "reviewer" } }],
          200,
          { link: '<https://api.github.com/repos/owner/repo/issues/12/comments?page=2>; rel="next"' });
      }
      if (url.includes("/reviews?")) return response([{ id: 3, state: "APPROVED", body: "Approved", user: { login: "reviewer" } }]);
      if (url.includes("/files?")) return response([{ filename: "artworks/cat.json", status: "modified", additions: 2, deletions: 1, changes: 3 }]);
      if (url.includes("/commits?")) return response([{ sha: "123456789", commit: { message: "Update cat", author: { name: "Artist" } } }]);
      return response({
        allow_merge_commit: true,
        allow_squash_merge: false,
        allow_rebase_merge: true,
        permissions: { push: true },
      });
    });

    const result = await service.getPull("token", "owner", "repo", 12, 1);
    assert.equal(result.pull.mergeable, true);
    assert.equal(result.comments[0].body, "Looks good");
    assert.equal(result.commentsHasNext, true);
    assert.equal(result.reviews[0].state, "APPROVED");
    assert.equal(result.files[0].filename, "artworks/cat.json");
    assert.equal(result.commits[0].message, "Update cat");
    assert.deepEqual(result.mergeMethods, { merge: true, squash: false, rebase: true });
    assert.equal(result.permissions.push, true);
  });

  it("blocks merging unless GitHub confirms mergeability and target write permission", async () => {
    let mergeRequested = false;
    const service = new PullRequestService(async (url, options) => {
      if (url.endsWith("/pulls/12")) return response(pull({ mergeable: false }));
      if (url.endsWith("/pulls/12/merge")) {
        mergeRequested = true;
        return response({ merged: true, sha: "merged-sha" });
      }
      return response({ permissions: { push: true }, allow_merge_commit: true });
    });

    await assert.rejects(
      service.mergePull("token", "owner", "repo", 12, { mergeMethod: "merge" }),
      (error) => error.status === 409 && error.code === "NOT_MERGEABLE"
    );
    assert.equal(mergeRequested, false);

    const noPermission = new PullRequestService(async (url) => (
      url.endsWith("/pulls/12")
        ? response(pull())
        : response({ permissions: { push: false }, allow_merge_commit: true })
    ));
    await assert.rejects(
      noPermission.mergePull("token", "owner", "repo", 12),
      (error) => error.status === 403
    );
  });

  it("uses only repository-enabled merge methods after permission checks", async () => {
    const calls = [];
    const service = new PullRequestService(async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pulls/12")) return response(pull());
      if (url.endsWith("/pulls/12/merge")) return response({ merged: true, sha: "merged-sha", message: "Merged" });
      return response({ permissions: { push: true }, allow_merge_commit: true, allow_squash_merge: false });
    });

    await assert.rejects(
      service.mergePull("token", "owner", "repo", 12, { mergeMethod: "squash" }),
      (error) => error.status === 400
    );
    assert.equal(calls.some(({ url }) => url.endsWith("/pulls/12/merge")), false);
    const result = await service.mergePull("token", "owner", "repo", 12, { mergeMethod: "merge" });
    assert.equal(result.merged, true);
  });

  it("does not submit merges for a closed pull request", async () => {
    let mergeRequested = false;
    const service = new PullRequestService(async (url) => {
      if (url.endsWith("/pulls/12")) return response(pull({ state: "closed" }));
      if (url.endsWith("/pulls/12/merge")) mergeRequested = true;
      return response({ permissions: { push: true }, allow_merge_commit: true });
    });

    await assert.rejects(
      service.mergePull("token", "owner", "repo", 12),
      (error) => error.status === 409
    );
    assert.equal(mergeRequested, false);
  });
});
