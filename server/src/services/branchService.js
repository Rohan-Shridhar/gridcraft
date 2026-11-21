import { assertSafeBranchName, CreateBranchSchema, RenameBranchSchema } from "../validators/branchValidator.js";
import { githubRequest } from "../utils/githubClient.js";

function normalizePagination(page, perPage, defaultPerPage) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedPerPage = Number.parseInt(perPage, 10);
  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    perPage:
      Number.isFinite(parsedPerPage) && parsedPerPage > 0
        ? Math.min(100, parsedPerPage)
        : defaultPerPage,
  };
}

export class BranchService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const result = await githubRequest(this.fetch, endpoint, accessToken, options);
    return result;
  }

  async listBranches(accessToken, owner, repoName, { page = 1, perPage = 30 } = {}) {
    const pagination = normalizePagination(page, perPage, 30);
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;
    const { data, headers } = await this.#request(
      `${repoPath}/branches?per_page=${pagination.perPage}&page=${pagination.page}`,
      accessToken
    );
    const repo = await this.#request(repoPath, accessToken);
    const defaultBranch = repo.data.default_branch;
    return {
      branches: (data || []).map((branch) => ({
        name: branch.name,
        sha: branch.commit?.sha,
        protected: !!branch.protected,
        isDefault: branch.name === defaultBranch,
      })),
      defaultBranch,
      page: pagination.page,
      perPage: pagination.perPage,
      link: headers.get("link"),
    };
  }

  async getBranch(accessToken, owner, repoName, branchName) {
    assertSafeBranchName(branchName);
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}`,
      accessToken
    );
    return {
      name: data.name,
      sha: data.commit?.sha,
      protected: !!data.protected,
      commit: {
        sha: data.commit?.sha,
        message: data.commit?.commit?.message,
        author: data.commit?.commit?.author?.name,
        date: data.commit?.commit?.author?.date,
        htmlUrl: data.commit?.html_url,
      },
    };
  }

  async createBranch(accessToken, owner, repoName, input) {
    const validated = CreateBranchSchema.parse(input);
    const name = assertSafeBranchName(validated.name);
    if (validated.from !== undefined) {
      assertSafeBranchName(validated.from);
    }
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;
    const repository = await this.#request(repoPath, accessToken);
    const from = assertSafeBranchName(validated.from || repository.data.default_branch || "master");
    const base = await this.getBranch(accessToken, owner, repoName, from);
    const { data } = await this.#request(`${repoPath}/git/refs`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${name}`,
        sha: base.sha,
      }),
    });
    return { name, sha: data.object?.sha || base.sha, ref: data.ref };
  }

  async renameBranch(accessToken, owner, repoName, branchName, input) {
    assertSafeBranchName(branchName);
    const { newName } = RenameBranchSchema.parse(input);
    assertSafeBranchName(newName);
    if (newName === branchName) {
      const err = new Error("New branch name must differ from the current branch name.");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;
    const repository = await this.#request(repoPath, accessToken);
    if (branchName === repository.data.default_branch) {
      const err = new Error("The default branch cannot be renamed from GridCraft.");
      err.status = 400;
      throw err;
    }
    const { data } = await this.#request(
      `${repoPath}/branches/${encodeURIComponent(branchName)}/rename`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ new_name: newName }),
      }
    );
    return { name: data.name, sha: data.commit?.sha };
  }

  async deleteBranch(accessToken, owner, repoName, branchName) {
    assertSafeBranchName(branchName);
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;
    const repo = await this.#request(repoPath, accessToken);
    if (branchName === repo.data.default_branch) {
      const err = new Error("The default branch cannot be deleted.");
      err.status = 400;
      err.code = "FORBIDDEN";
      throw err;
    }
    await this.#request(
      `${repoPath}/git/refs/heads/${encodeURIComponent(branchName)}`,
      accessToken,
      { method: "DELETE" }
    );
    return { success: true, branch: branchName };
  }

  async compare(accessToken, owner, repoName, base, head) {
    assertSafeBranchName(base);
    assertSafeBranchName(head);
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
      accessToken
    );
    return {
      status: data.status,
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      permalinkUrl: data.permalink_url,
      files: (data.files || []).map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      })),
      commits: (data.commits || []).slice(0, 30).map((commit) => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name,
        date: commit.commit.author?.date,
        htmlUrl: commit.html_url,
      })),
    };
  }

  async listCommits(accessToken, owner, repoName, branch = "master", { page = 1, perPage = 20 } = {}) {
    assertSafeBranchName(branch);
    const pagination = normalizePagination(page, perPage, 20);
    const { data } = await this.#request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/commits?sha=${encodeURIComponent(branch)}&page=${pagination.page}&per_page=${pagination.perPage}`,
      accessToken
    );
    return (data || []).map((c) => ({
      sha: c.sha,
      shortSha: typeof c.sha === "string" ? c.sha.slice(0, 7) : "",
      message: c.commit?.message || "",
      authorLogin: c.author?.login || c.commit?.author?.name,
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit?.author?.date,
      htmlUrl: c.html_url,
    }));
  }
}

export const branchService = new BranchService();
