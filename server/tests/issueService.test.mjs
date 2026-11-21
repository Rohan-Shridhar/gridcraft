import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppStore } from "../src/services/appStore.js";
import { IssueService } from "../src/services/issueService.js";

describe("GridCraft issue service", () => {
  it("filters and paginates GridCraft-owned issues and comments", () => {
    const store = new AppStore(":memory:");
    const owner = { id: 21, login: "owner", name: "Owner" };
    const author = { id: 22, login: "artist", name: "Artist" };
    const album = store.createAlbum(owner, { slug: "forest", name: "Forest" });
    const service = new IssueService(store);

    try {
      const { issue } = service.createIssue("unused", "owner", "forest", author, {
        title: "Add a tree",
        body: "A tree sprite is needed",
        labels: ["art"],
        assignees: ["owner"],
      });
      assert.equal(issue.htmlUrl, null);

      for (let index = 0; index < 21; index += 1) {
        service.addComment("unused", "owner", "forest", owner, issue.number, `Comment ${index + 1}`);
      }

      const firstPage = service.getIssue("unused", "owner", "forest", issue.number, 1);
      const secondPage = service.getIssue("unused", "owner", "forest", issue.number, 2);
      assert.equal(firstPage.comments.length, 20);
      assert.equal(firstPage.commentsHasNext, true);
      assert.equal(secondPage.comments.length, 1);
      assert.equal(secondPage.commentsHasNext, false);

      const filtered = service.listIssues("unused", "owner", "forest", {
        author: "artist",
        labels: "art",
        q: "tree",
      });
      assert.equal(filtered.total, 1);
      assert.equal(filtered.issues[0].number, issue.number);

      assert.throws(
        () => service.updateIssue("unused", "owner", "forest", { id: 23, login: "other" }, issue.number, { title: "Changed" }),
        (error) => error.status === 403
      );
      assert.equal(store.getAlbum("owner", "forest").id, album.id);
    } finally {
      store.close();
    }
  });

  it("rejects whitespace-only titles/comments and empty updates, deduplicates labels/assignees case-insensitively, and normalizes invalid list state", () => {
    const store = new AppStore(":memory:");
    const owner = { id: 21, login: "owner", name: "Owner" };
    const author = { id: 22, login: "artist", name: "Artist" };
    store.createAlbum(owner, { slug: "forest", name: "Forest" });
    const service = new IssueService(store);

    try {
      assert.throws(() =>
        service.createIssue("unused", "owner", "forest", author, {
          title: "   ",
        })
      );

      const { issue } = service.createIssue("unused", "owner", "forest", author, {
        title: "  Add a lantern  ",
        labels: ["Art", "art", "LIGHTING"],
        assignees: ["Owner", "owner"],
      });
      assert.equal(issue.title, "Add a lantern");
      assert.deepEqual(
        issue.labels.map((label) => label.name),
        ["Art", "LIGHTING"]
      );
      assert.deepEqual(
        issue.assignees.map((assignee) => assignee.login),
        ["Owner"]
      );

      assert.throws(
        () => service.updateIssue("unused", "owner", "forest", author, issue.number, {}),
        (error) => error.status === 400
      );
      assert.throws(() =>
        service.updateIssue("unused", "owner", "forest", author, issue.number, { title: "   " })
      );
      assert.throws(() =>
        service.addComment("unused", "owner", "forest", owner, issue.number, "   ")
      );

      const listed = service.listIssues("unused", "owner", "forest", {
        state: "invalid-state",
      });
      assert.equal(listed.total, 1);
      assert.equal(listed.issues[0].number, issue.number);
    } finally {
      store.close();
    }
  });

  it("validates positive integer issue numbers and normalizes non-integer pagination and non-string filters", () => {
    const store = new AppStore(":memory:");
    const owner = { id: 21, login: "owner", name: "Owner" };
    const author = { id: 22, login: "artist", name: "Artist" };
    store.createAlbum(owner, { slug: "forest", name: "Forest" });
    const service = new IssueService(store);

    try {
      const { issue } = service.createIssue("unused", "owner", "forest", author, {
        title: "Validate issue inputs",
        labels: ["bug"],
      });

      for (const badNumber of ["abc", "", 0, -1, 1.5, Number.POSITIVE_INFINITY, null]) {
        assert.throws(
          () => service.getIssue("unused", "owner", "forest", badNumber),
          (error) => error.status === 400
        );
      }

      const listed = service.listIssues("unused", "owner", "forest", {
        page: Number.POSITIVE_INFINITY,
        perPage: 1.5,
        author: ["artist"],
        assignee: { login: "owner" },
        labels: ["bug"],
        q: ["Validate"],
      });
      assert.equal(listed.page, 1);
      assert.equal(listed.perPage, 20);
      assert.equal(listed.total, 1);

      const nullQueryList = service.listIssues("unused", "owner", "forest", null);
      assert.equal(nullQueryList.page, 1);
      assert.equal(nullQueryList.perPage, 20);
      assert.equal(nullQueryList.total, 1);

      const fetched = service.getIssue("unused", "owner", "forest", issue.number, Number.POSITIVE_INFINITY);
      assert.equal(fetched.commentsPage, 1);
      assert.equal(fetched.issue.number, issue.number);
    } finally {
      store.close();
    }
  });
});
