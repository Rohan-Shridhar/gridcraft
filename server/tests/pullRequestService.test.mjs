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

  it("rejects state changes on a merged pull request and preserves mergedAt on metadata edits", () => {
    const store = new AppStore(":memory:");
    const owner = { id: 51, login: "owner", name: "Owner" };
    const contributor = { id: 52, login: "contributor", name: "Contributor" };
    const base = store.createAlbum(owner, { slug: "base", name: "Base" });
    const head = store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });
    const service = new PullRequestService(async () => {
      throw new Error("No GitHub request should be made");
    }, store);

    try {
      const created = store.createPull({
        baseAlbumId: base.id,
        headAlbumId: head.id,
        author: contributor,
        title: "Add sprites",
        body: "Initial body",
      });
      const pullNumber = created.pull.number;

      const closed = service.updatePull("token", "owner", "base", contributor, pullNumber, {
        state: "closed",
      });
      assert.equal(closed.pull.state, "closed");
      assert.equal(closed.pull.merged, false);
      assert.equal(closed.pull.mergedAt, null);

      const reopened = service.updatePull("token", "owner", "base", contributor, pullNumber, {
        state: "open",
      });
      assert.equal(reopened.pull.state, "open");
      assert.equal(reopened.pull.merged, false);
      assert.equal(reopened.pull.mergedAt, null);

      const merged = store.setPullState(pullNumber, "merged");
      assert.equal(merged.pull.merged, true);
      const originalMergedAt = "2026-01-01T00:00:00.000Z";
      store.db.prepare("UPDATE pull_requests SET merged_at = ? WHERE id = ?").run(originalMergedAt, pullNumber);

      for (const nextState of ["open", "closed"]) {
        assert.throws(
          () => service.updatePull("token", "owner", "base", owner, pullNumber, { state: nextState }),
          (error) => error.status === 409
        );
        const current = service.getPull("token", "owner", "base", owner, pullNumber).pull;
        assert.equal(current.merged, true);
        assert.equal(current.state, "closed");
        assert.equal(current.mergedAt, originalMergedAt);
      }

      const edited = service.updatePull("token", "owner", "base", owner, pullNumber, {
        title: "Add forest sprites",
        body: "Updated notes",
      });
      assert.equal(edited.pull.title, "Add forest sprites");
      assert.equal(edited.pull.body, "Updated notes");
      assert.equal(edited.pull.merged, true);
      assert.equal(edited.pull.state, "closed");
      assert.equal(edited.pull.mergedAt, originalMergedAt);
    } finally {
      store.close();
    }
  });

  it("paginates pull request comments and returns newly added comments past the first page", () => {
    const store = new AppStore(":memory:");
    const owner = { id: 61, login: "owner", name: "Owner" };
    const contributor = { id: 62, login: "contributor", name: "Contributor" };
    const base = store.createAlbum(owner, { slug: "base", name: "Base" });
    const head = store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });
    const service = new PullRequestService(async () => {
      throw new Error("No GitHub request should be made");
    }, store);

    try {
      const created = store.createPull({
        baseAlbumId: base.id,
        headAlbumId: head.id,
        author: contributor,
        title: "Add sprites",
      });
      const pullNumber = created.pull.number;

      for (let i = 1; i <= 25; i += 1) {
        const added = service.commentOnPull("token", "owner", "base", owner, pullNumber, `Comment ${i}`);
        assert.equal(added.comment.body, `Comment ${i}`);
      }

      const firstPage = service.getPull("token", "owner", "base", contributor, pullNumber, 1);
      assert.equal(firstPage.comments.length, 20);
      assert.equal(firstPage.comments[0].body, "Comment 1");
      assert.equal(firstPage.comments[19].body, "Comment 20");
      assert.equal(firstPage.commentsPage, 1);
      assert.equal(firstPage.commentsHasNext, true);
      assert.equal(firstPage.pull.comments, 25);

      const secondPage = service.getPull("token", "owner", "base", contributor, pullNumber, 2);
      assert.equal(secondPage.comments.length, 5);
      assert.equal(secondPage.comments[0].body, "Comment 21");
      assert.equal(secondPage.comments[4].body, "Comment 25");
      assert.equal(secondPage.commentsPage, 2);
      assert.equal(secondPage.commentsHasNext, false);
    } finally {
      store.close();
    }
  });

  it("rejects whitespace-only PR titles and comments, normalizes invalid listPulls state/pagination, and rejects non-integer PR numbers", async () => {
    const store = new AppStore(":memory:");
    const owner = { id: 71, login: "owner", name: "Owner" };
    const contributor = { id: 72, login: "contributor", name: "Contributor" };
    const base = store.createAlbum(owner, { slug: "base", name: "Base" });
    const head = store.createAlbum(contributor, { slug: "proposal", name: "Proposal" });
    const service = new PullRequestService(async () => {
      throw new Error("No GitHub request should be made");
    }, store);

    try {
      await assert.rejects(
        () =>
          service.createPull("token", "owner", "base", contributor, {
            title: "   ",
            headOwner: "contributor",
            headAlbum: "proposal",
          }),
        (err) => err.name === "ZodError"
      );

      const created = store.createPull({
        baseAlbumId: base.id,
        headAlbumId: head.id,
        author: contributor,
        title: "Valid PR",
      });
      const pullNumber = created.pull.number;

      assert.throws(
        () => service.updatePull("token", "owner", "base", contributor, pullNumber, { title: "   " }),
        (err) => err.name === "ZodError"
      );
      assert.throws(
        () => service.commentOnPull("token", "owner", "base", owner, pullNumber, "   "),
        (err) => err.name === "ZodError"
      );

      const listed = service.listPulls("token", "owner", "base", {
        state: "invalid-state",
        page: 1.7,
        perPage: 25.9,
      });
      assert.equal(listed.pulls.length, 1);
      assert.equal(listed.page, 1);
      assert.equal(listed.perPage, 25);

      assert.throws(
        () => service.getPull("token", "owner", "base", owner, "not-a-number"),
        (err) => err.status === 404
      );
    } finally {
      store.close();
    }
  });
});
