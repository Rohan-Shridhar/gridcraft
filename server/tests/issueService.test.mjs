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
});
