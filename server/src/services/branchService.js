import { assertSafeBranchName, CreateBranchSchema, RenameBranchSchema } from "../validators/branchValidator.js";
import { githubRequest } from "../utils/githubClient.js";

export class BranchService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    const result = await githubRequest(this.fetch, endpoint, accessToken, options);
    return result;
  }

  async listBranches(accessToken, owner, repoName, { page = 1, perPage = 30 } = {}) {
    const { data, headers } = await this.#request(
      `/repos/${owner}/${repoName}/branches?per_page=${perPage}&page=${page}`,
      accessToken
    );
    const repo = await this.#request(`/repos/${owner}/${repoName}`, accessToken);
    const defaultBranch = repo.data.default_branch;
    return {
      branches: (data || []).map((branch) => ({
        name: branch.name,
        sha: branch.commit?.sha,
        protected: !!branch.protected,
        isDefault: branch.name === defaultBranch,
      })),
      defaultBranch,
      page,
      perPage,
      link: headers.get("link"),
    };
  }

  async getBranch(accessToken, owner, repoName, branchName) {
    assertSafeBranchName(branchName);
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/branches/${encodeURIComponent(branchName)}`,
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
    const from = assertSafeBranchName(validated.from || "master");
    const base = await this.getBranch(accessToken, owner, repoName, from);
    const { data } = await this.#request(`/repos/${owner}/${repoName}/git/refs`, accessToken, {
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
    if (branchName === "master") {
      const err = new Error("The default branch master cannot be renamed from GridCraft.");
      err.status = 400;
      throw err;
    }
    const { newName } = RenameBranchSchema.parse(input);
    assertSafeBranchName(newName);
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/branches/${encodeURIComponent(branchName)}/rename`,
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
    const repo = await this.#request(`/repos/${owner}/${repoName}`, accessToken);
    if (branchName === repo.data.default_branch || branchName === "master") {
      const err = new Error("The default branch cannot be deleted.");
      err.status = 400;
      err.code = "FORBIDDEN";
      throw err;
    }
    await this.#request(
      `/repos/${owner}/${repoName}/git/refs/heads/${encodeURIComponent(branchName)}`,
      accessToken,
      { method: "DELETE" }
    );
    return { success: true, branch: branchName };
  }

  async compare(accessToken, owner, repoName, base, head) {
    assertSafeBranchName(base);
    assertSafeBranchName(head);
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
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
    const { data } = await this.#request(
      `/repos/${owner}/${repoName}/commits?sha=${encodeURIComponent(branch)}&page=${page}&per_page=${perPage}`,
      accessToken
    );
    return (data || []).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message,
      authorLogin: c.author?.login || c.commit.author?.name,
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit.author?.date,
      htmlUrl: c.html_url,
    }));
  }
}

export const branchService = new BranchService();
