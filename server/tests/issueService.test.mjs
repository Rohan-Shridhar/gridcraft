import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IssueService } from "../src/services/issueService.js";

function response(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function issue(number, overrides = {}) {
  return {
    number,
    title: `Issue ${number}`,
    body: "details",
    state: "open",
    html_url: `https://github.com/owner/repo/issues/${number}`,
    user: { login: "author", avatar_url: "https://avatars.example/author.png" },
    labels: [],
    assignees: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("Issue GitHub API integration", () => {
  it("uses GitHub search, preserves pagination, and excludes pull requests", async () => {
    let requestUrl;
    const service = new IssueService(async (url) => {
      requestUrl = new URL(url);
      return response({
        items: [
          issue(1),
          issue(2, { pull_request: { url: "https://api.github.com/repos/owner/repo/pulls/2" } }),
        ],
      }, 200, { link: '<https://api.github.com/search/issues?page=2>; rel="next"' });
    });

    const result = await service.listIssues("token", "owner", "repo", {
      q: "pixel art",
      state: "closed",
      author: "rohan",
      assignee: "artist",
      labels: "bug,needs review",
      page: 1,
      perPage: 20,
    });
    const query = requestUrl.searchParams.get("q");

    assert.equal(requestUrl.pathname, "/search/issues");
    assert.match(query, /repo:owner\/repo/);
    assert.match(query, /state:closed/);
    assert.match(query, /author:rohan/);
    assert.match(query, /assignee:artist/);
    assert.match(query, /label:"needs review"/);
    assert.deepEqual(result.issues.map((item) => item.number), [1]);
    assert.match(result.link, /rel="next"/);
  });

  it("loads the requested comment page and returns its pagination link", async () => {
    const urls = [];
    const service = new IssueService(async (url) => {
      urls.push(new URL(url));
      if (url.includes("/comments?")) {
        return response([{ id: 20, body: "comment", created_at: "2026-01-03T00:00:00Z", user: { login: "reader" } }],
          200,
          { link: '<https://api.github.com/repos/owner/repo/issues/9/comments?page=3>; rel="next"' });
      }
      return response(issue(9));
    });

    const result = await service.getIssue("token", "owner", "repo", 9, 2);
    assert.equal(urls[1].searchParams.get("page"), "2");
    assert.equal(result.comments[0].body, "comment");
    assert.match(result.commentsLink, /rel="next"/);
  });
});
