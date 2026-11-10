import { githubRequest } from "../utils/githubClient.js";

function mapRepo(repo) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login,
    ownerAvatar: repo.owner?.avatar_url,
    description: repo.description || "",
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    permissions: repo.permissions || {},
    fork: !!repo.fork,
    parent: repo.parent
      ? { fullName: repo.parent.full_name, owner: repo.parent.owner?.login, name: repo.parent.name }
      : null,
    source: repo.source
      ? { fullName: repo.source.full_name, owner: repo.source.owner?.login, name: repo.source.name }
      : null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
  };
}

export class ForkService {
  constructor(fetchFn = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  async #request(endpoint, accessToken, options = {}) {
    return githubRequest(this.fetch, endpoint, accessToken, options);
  }

  async forkAlbum(accessToken, owner, repoName) {
    const { data } = await this.#request(`/repos/${owner}/${repoName}/forks`, accessToken, {
      method: "POST",
      retry: false,
    });
    return { repo: mapRepo(data) };
  }

  async listUserForks(accessToken, { page = 1, perPage = 30 } = {}) {
    const { data } = await this.#request(
      `/user/repos?affiliation=owner&sort=updated&page=${page}&per_page=${perPage}`,
      accessToken
    );
    const forks = (data || []).filter((repo) => repo.fork).map(mapRepo);
    return { forks, page, perPage };
  }
}

export const forkService = new ForkService();
