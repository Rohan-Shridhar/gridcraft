import { z } from "zod";
import { githubRequest } from "../utils/githubClient.js";

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  body: z.string().max(65536).optional(),
  state: z.enum(["open", "closed"]).optional(),
});

function mapIssue(issue) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body || "",
    state: issue.state,
    htmlUrl: issue.html_url,
    user: {
      login: issue.user?.login,
      avatarUrl: issue.user?.avatar_url,
    },
    labels: (issue.labels || []).map((label) =>
      typeof label === "string" ? { name: label } : { name: label.name, color: label.color }
    ),
    assignees: (issue.assignees || []).map((user) => ({
      login: user.login,
      avatarUrl: user.avatar_url,
    })),
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    isPullRequest: Boolean(issue.pull_request),
  };
}

export class IssueService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const { data, headers } = await githubRequest(this.fetch, endpoint, accessToken, options);
    return { data, headers };
  }

  async listIssues(accessToken, owner, repoName, query = {}) {
    const state = query.state || "open";
    const page = query.page || 1;
    const perPage = query.perPage || 20;
    const search = query.q ? `&q=${encodeURIComponent(query.q)}` : "";
    const creator = query.author ? `&creator=${encodeURIComponent(query.author)}` : "";
    const assignee = query.assignee ? `&assignee=${encodeURIComponent(query.assignee)}` : "";
    const labels = query.labels ? `&labels=${encodeURIComponent(query.labels)}` : "";
    const { data, headers } = await this.#request(
      `/repos/${owner}/${repoName}/issues?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}${creator}${assignee}${labels}${search}`,
      accessToken
    );
    const issues = (data || []).filter((item) => !item.pull_request).map(mapIssue);
    return { issues, page, perPage, link: headers.get("link") };
  }

  async getIssue(accessToken, owner, repoName, number) {
    const { data } = await this.#request(`/repos/${owner}/${repoName}/issues/${number}`, accessToken);
    if (data.pull_request) {
      const err = new Error("That number belongs to a pull request, not an issue.");
      err.status = 404;
      throw err;
    }
    const commentsRes = await this.#request(
      `/repos/${owner}/${repoName}/issues/${number}/comments?per_page=50`,
      accessToken
    );
    return {
      issue: mapIssue(data),
      comments: (commentsRes.data || []).map((comment) => ({
        id: comment.id,
        body: comment.body,
        htmlUrl: comment.html_url,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        user: { login: comment.user?.login, avatarUrl: comment.user?.avatar_url },
      })),
    };
  }

  async createIssue(accessToken, owner, repoName, input) {
    const validated = CreateIssueSchema.parse(input);
    const { data } = await this.#request(`/repos/${owner}/${repoName}/issues`, accessToken, {
      method: "POST",
      body: JSON.stringify(validated),
    });
    return { issue: mapIssue(data) };
  }

  async updateIssue(accessToken, owner, repoName, number, input) {
    const validated = UpdateIssueSchema.parse(input);
    const { data } = await this.#request(`/repos/${owner}/${repoName}/issues/${number}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify(validated),
    });
    return { issue: mapIssue(data) };
  }

  async addComment(accessToken, owner, repoName, number, body) {
    const text = z.string().min(1).max(65536).parse(body);
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/issues/${number}/comments`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ body: text }),
      }
    );
    return {
      comment: {
        id: data.id,
        body: data.body,
        createdAt: data.created_at,
        user: { login: data.user?.login, avatarUrl: data.user?.avatar_url },
      },
    };
  }
}

export const issueService = new IssueService();
