import { z } from "zod";
import { githubRequest } from "../utils/githubClient.js";
import { assertSafeBranchName } from "../validators/branchValidator.js";

const CreatePullSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional().default(""),
  head: z.string().min(1).max(255),
  base: z.string().min(1).max(255).optional().default("master"),
  headRepo: z.string().max(201).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).optional(),
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
    maintainerCanModify: pr.maintainer_can_modify,
    assignees: (pr.assignees || []).map((assignee) => ({
      login: assignee.login,
      avatarUrl: assignee.avatar_url,
    })),
    labels: (pr.labels || []).map((label) => ({ name: label.name, color: label.color })),
    requestedReviewers: (pr.requested_reviewers || []).map((reviewer) => ({
      login: reviewer.login,
      avatarUrl: reviewer.avatar_url,
    })),
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
      hasNext: /rel="next"/.test(headers.get("link") || ""),
    };
  }

  async getPull(accessToken, owner, repoName, number, commentsPage = 1) {
    const { data } = await this.#request(`/repos/${owner}/${repoName}/pulls/${number}`, accessToken);
    const [comments, reviews, files, commits, repository] = await Promise.all([
      this.#request(
        `/repos/${owner}/${repoName}/issues/${number}/comments?per_page=50&page=${commentsPage}`,
        accessToken
      ),
      this.#request(`/repos/${owner}/${repoName}/pulls/${number}/reviews?per_page=100`, accessToken),
      this.#request(`/repos/${owner}/${repoName}/pulls/${number}/files?per_page=100`, accessToken),
      this.#request(`/repos/${owner}/${repoName}/pulls/${number}/commits?per_page=100`, accessToken),
      this.#request(`/repos/${owner}/${repoName}`, accessToken),
    ]);
    return {
      pull: mapPull(data),
      commentsPage,
      commentsHasNext: /rel="next"/.test(comments.headers.get("link") || ""),
      comments: (comments.data || []).map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        htmlUrl: comment.html_url,
        user: { login: comment.user?.login, avatarUrl: comment.user?.avatar_url },
      })),
      reviews: (reviews.data || []).map((review) => ({
        id: review.id,
        state: review.state,
        body: review.body || "",
        submittedAt: review.submitted_at,
        htmlUrl: review.html_url,
        user: { login: review.user?.login, avatarUrl: review.user?.avatar_url },
      })),
      files: (files.data || []).map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        previousFilename: file.previous_filename,
        blobUrl: file.blob_url,
        rawUrl: file.raw_url,
      })),
      commits: (commits.data || []).map((commit) => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name,
        htmlUrl: commit.html_url,
      })),
      mergeMethods: {
        merge: Boolean(repository.data?.allow_merge_commit),
        squash: Boolean(repository.data?.allow_squash_merge),
        rebase: Boolean(repository.data?.allow_rebase_merge),
      },
      permissions: repository.data?.permissions || {},
    };
  }

  async createPull(accessToken, owner, repoName, input) {
    const validated = CreatePullSchema.parse(input);
    assertSafeBranchName(validated.base);
    assertSafeBranchName(validated.head);
    const head = validated.headRepo ? `${validated.headRepo.split("/")[0]}:${validated.head}` : validated.head;
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

  async commentOnPull(accessToken, owner, repoName, number, body) {
    if (typeof body !== "string" || !body.trim() || body.length > 65536) {
      const err = new Error("A comment between 1 and 65,536 characters is required.");
      err.status = 400;
      throw err;
    }
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/issues/${number}/comments`,
      accessToken,
      { method: "POST", body: JSON.stringify({ body }) }
    );
    return {
      comment: {
        id: data.id,
        body: data.body,
        createdAt: data.created_at,
        htmlUrl: data.html_url,
        user: { login: data.user?.login, avatarUrl: data.user?.avatar_url },
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
    const [{ data: pull }, { data: repository }] = await Promise.all([
      this.#request(`/repos/${owner}/${repoName}/pulls/${number}`, accessToken),
      this.#request(`/repos/${owner}/${repoName}`, accessToken),
    ]);
    if (pull.state !== "open" || pull.merged || pull.merged_at) {
      const err = new Error("Only open, unmerged pull requests can be merged.");
      err.status = 409;
      err.code = "NOT_MERGEABLE";
      throw err;
    }
    if (pull.mergeable !== true) {
      const err = new Error(
        pull.mergeable === false
          ? "GitHub reports this pull request has merge conflicts."
          : "GitHub has not confirmed that this pull request is mergeable yet. Refresh and try again."
      );
      err.status = 409;
      err.code = "NOT_MERGEABLE";
      throw err;
    }
    if (repository.permissions?.push !== true) {
      const err = new Error("You need write permission on the target repository to merge this pull request.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    const methodEnabled = {
      merge: repository.allow_merge_commit,
      squash: repository.allow_squash_merge,
      rebase: repository.allow_rebase_merge,
    }[mergeMethod];
    if (methodEnabled !== true) {
      const err = new Error(`The ${mergeMethod} merge method is disabled for this repository.`);
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
