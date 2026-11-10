import { z } from "zod";
import { githubRequest } from "../utils/githubClient.js";
import { assertSafeBranchName } from "../validators/branchValidator.js";

const CreatePullSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  head: z.string().min(1),
  base: z.string().min(1).optional().default("master"),
  headRepo: z.string().optional(),
});

const ReviewSchema = z.object({
  body: z.string().max(65536).optional().default(""),
  event: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]),
});

function mapPull(pr) {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || "",
    state: pr.merged_at ? "merged" : pr.state,
    merged: Boolean(pr.merged_at || pr.merged),
    draft: !!pr.draft,
    htmlUrl: pr.html_url,
    user: { login: pr.user?.login, avatarUrl: pr.user?.avatar_url },
    base: { ref: pr.base?.ref, sha: pr.base?.sha, repo: pr.base?.repo?.full_name },
    head: { ref: pr.head?.ref, sha: pr.head?.sha, repo: pr.head?.repo?.full_name },
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    comments: pr.comments,
    commits: pr.commits,
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
  };
}

export class PullRequestService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    return githubRequest(this.fetch, endpoint, accessToken, options);
  }

  async listPulls(accessToken, owner, repoName, query = {}) {
    const state = query.state || "open";
    const page = query.page || 1;
    const perPage = query.perPage || 20;
    const { data, headers } = await this.#request(
      `/repos/${owner}/${repoName}/pulls?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}`,
      accessToken
    );
    return {
      pulls: (data || []).map(mapPull),
      page,
      perPage,
      link: headers.get("link"),
    };
  }

  async getPull(accessToken, owner, repoName, number) {
    const { data } = await this.#request(`/repos/${owner}/${repoName}/pulls/${number}`, accessToken);
    const comments = await this.#request(
      `/repos/${owner}/${repoName}/issues/${number}/comments?per_page=50`,
      accessToken
    );
    const files = await this.#request(
      `/repos/${owner}/${repoName}/pulls/${number}/files?per_page=100`,
      accessToken
    );
    const commits = await this.#request(
      `/repos/${owner}/${repoName}/pulls/${number}/commits?per_page=50`,
      accessToken
    );
    return {
      pull: mapPull(data),
      comments: (comments.data || []).map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        user: { login: comment.user?.login, avatarUrl: comment.user?.avatar_url },
      })),
      files: (files.data || []).map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      })),
      commits: (commits.data || []).map((commit) => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name,
        htmlUrl: commit.html_url,
      })),
    };
  }

  async createPull(accessToken, owner, repoName, input) {
    const validated = CreatePullSchema.parse(input);
    assertSafeBranchName(validated.base);
    const head = validated.headRepo ? `${validated.headRepo}:${validated.head}` : validated.head;
    const { data } = await this.#request(`/repos/${owner}/${repoName}/pulls`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        title: validated.title,
        body: validated.body,
        head,
        base: validated.base,
      }),
    });
    return { pull: mapPull(data) };
  }

  async updatePull(accessToken, owner, repoName, number, input) {
    const { data } = await this.#request(`/repos/${owner}/${repoName}/pulls/${number}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return { pull: mapPull(data) };
  }

  async submitReview(accessToken, owner, repoName, number, input) {
    const validated = ReviewSchema.parse(input);
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/pulls/${number}/reviews`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify(validated),
      }
    );
    return {
      review: {
        id: data.id,
        state: data.state,
        body: data.body,
        htmlUrl: data.html_url,
      },
    };
  }

  async mergePull(accessToken, owner, repoName, number, input = {}) {
    const mergeMethod = input.mergeMethod || "merge";
    if (!["merge", "squash", "rebase"].includes(mergeMethod)) {
      const err = new Error("Unsupported merge method");
      err.status = 400;
      throw err;
    }
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/pulls/${number}/merge`,
      accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          merge_method: mergeMethod,
          commit_title: input.commitTitle,
          commit_message: input.commitMessage,
        }),
        retry: false,
      }
    );
    return {
      merged: data.merged,
      sha: data.sha,
      message: data.message,
    };
  }
}

export const pullRequestService = new PullRequestService();
