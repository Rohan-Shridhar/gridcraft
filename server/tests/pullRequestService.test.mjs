import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppStore } from "../src/services/appStore.js";
import { PullRequestService } from "../src/services/pullRequestService.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GridCraft pull request service", () => {
  it("creates an app-owned request from the file changes between albums", async () => {
    const store = new AppStore(":memory:");
    const owner = { id: 31, login: "owner", name: "Owner" };
    const contributor = { id: 32, login: "contributor", name: "Contributor" };
    const base = store.createAlbum(owner, { slug: "base", name: "Base" });
    const head = store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });
    const service = new PullRequestService(async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname.endsWith("/gridcraft-artworks")) {
        return response({ default_branch: "main" });
      }
      if (requestUrl.pathname.endsWith("/git/trees/main")) {
        const isHead = requestUrl.pathname.includes("/contributor/");
        const slug = isHead ? "proposal" : "base";
        const files = isHead
          ? [
              { path: `${slug}/opening/story.json`, sha: "story-sha", type: "blob" },
              { path: `${slug}/opening/sprite.json`, sha: "new-sha", type: "blob" },
              { path: `${slug}/opening/extra.json`, sha: "added-sha", type: "blob" },
            ]
          : [
              { path: `${slug}/opening/story.json`, sha: "story-sha", type: "blob" },
              { path: `${slug}/opening/sprite.json`, sha: "old-sha", type: "blob" },
            ];
        return response({ truncated: false, tree: files });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    }, store);

    try {
      const result = await service.createPull("token", "owner", "base", contributor, {
        title: "Add forest sprites",
        headOwner: "contributor",
        headAlbum: "proposal",
      });
      const detail = service.getPull("token", "owner", "base", contributor, result.pull.number);
      assert.equal(result.pull.state, "open");
      assert.equal(result.pull.base.ref, "base");
      assert.equal(result.pull.head.ref, "proposal");
      assert.equal(detail.files.length, 2);
      assert.deepEqual(detail.files.map((file) => file.status), ["added", "modified"]);

      const comment = service.commentOnPull("token", "owner", "base", owner, result.pull.number, "Looks good");
      const review = service.submitReview("token", "owner", "base", owner, result.pull.number, {
        event: "APPROVE",
        body: "Approved",
      });
      assert.equal(comment.comment.body, "Looks good");
      assert.equal(review.review.state, "APPROVE");
      assert.equal(store.getAlbum("owner", "base").id, base.id);
      assert.equal(store.getAlbum("contributor", "proposal").id, head.id);
    } finally {
      store.close();
    }
  });

  it("rejects a source album that the submitter does not own", async () => {
    const store = new AppStore(":memory:");
    const owner = { id: 41, login: "owner", name: "Owner" };
    const other = { id: 42, login: "other", name: "Other" };
    store.createAlbum(owner, { slug: "base", name: "Base" });
    store.createAlbum(other, { slug: "source", name: "Source" });
    const service = new PullRequestService(async () => {
      throw new Error("No GitHub request should be made");
    }, store);

    try {
      await assert.rejects(
        service.createPull("token", "owner", "base", owner, {
          title: "Unauthorized source",
          headOwner: "other",
          headAlbum: "source",
        }),
        (error) => error.status === 403
      );
    } finally {
      store.close();
    }
  });
});
