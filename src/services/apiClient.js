/**
 * API client for GridCraft backend endpoints.
 * All requests are made with same-origin credentials (cookies) included.
 */

async function request(endpoint, options = {}) {
  const config = {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    credentials: "include",
    ...options,
  };

  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, config);

  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.error?.code || "REQUEST_FAILED";
    error.data = data;
    throw error;
  }

  return data;
}

function albumPath(owner, repo, suffix = "") {
  return `/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function withBranch(url, branch = "master") {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}branch=${encodeURIComponent(branch)}`;
}

export const apiClient = {
  async getHealth() {
    return request("/api/v1/health");
  },

  async getCurrentUser() {
    return request("/api/v1/auth/me");
  },

  async logout() {
    return request("/api/v1/auth/logout", { method: "POST" });
  },

  async disconnect() {
    return request("/api/v1/auth/disconnect", { method: "POST" });
  },

  getLoginUrl() {
    return "/api/v1/auth/github";
  },

  async listAlbums(page = 1, perPage = 30) {
    return request(`/api/v1/albums?page=${page}&per_page=${perPage}`);
  },

  async createAlbum(payload) {
    return request("/api/v1/albums", { method: "POST", body: payload });
  },

  async getAlbum(owner, repo) {
    return request(albumPath(owner, repo));
  },

  async updateAlbum(owner, repo, payload) {
    return request(albumPath(owner, repo), { method: "PATCH", body: payload });
  },

  async deleteAlbum(owner, repo, confirmName) {
    return request(albumPath(owner, repo), { method: "DELETE", body: { confirmName } });
  },

  async getAlbumCommits(owner, repo, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/commits"), branch));
  },

  async getAlbumTree(owner, repo, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/tree"), branch));
  },

  async initializeExistingRepo(owner, repo) {
    return request(albumPath(owner, repo, "/initialize"), { method: "POST" });
  },

  async listArtworks(owner, repo, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/artworks"), branch));
  },

  async createArtwork(owner, repo, payload, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/artworks"), branch), {
      method: "POST",
      body: payload,
    });
  },

  async getArtwork(owner, repo, artworkId, branch = "master") {
    return request(
      withBranch(albumPath(owner, repo, `/artworks/${encodeURIComponent(artworkId)}`), branch)
    );
  },

  async saveArtwork(owner, repo, artworkId, payload, branch = "master") {
    return request(
      withBranch(albumPath(owner, repo, `/artworks/${encodeURIComponent(artworkId)}`), branch),
      { method: "PUT", body: payload }
    );
  },

  async renameArtwork(owner, repo, artworkId, payload, branch = "master") {
    return request(
      withBranch(albumPath(owner, repo, `/artworks/${encodeURIComponent(artworkId)}`), branch),
      { method: "PATCH", body: payload }
    );
  },

  async deleteArtwork(owner, repo, artworkId, sha, branch = "master") {
    return request(
      withBranch(albumPath(owner, repo, `/artworks/${encodeURIComponent(artworkId)}`), branch),
      { method: "DELETE", body: { sha } }
    );
  },

  async getArtworkHistory(owner, repo, artworkId, branch = "master") {
    return request(
      withBranch(
        albumPath(owner, repo, `/artworks/${encodeURIComponent(artworkId)}/commits`),
        branch
      )
    );
  },

  async listStories(owner, repo, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/stories"), branch));
  },

  async createStory(owner, repo, payload, branch = "master") {
    return request(withBranch(albumPath(owner, repo, "/stories"), branch), {
      method: "POST",
      body: payload,
    });
  },

  async getStory(owner, repo, storyId, branch = "master") {
    return request(withBranch(albumPath(owner, repo, `/stories/${encodeURIComponent(storyId)}`), branch));
  },

  async saveStory(owner, repo, storyId, payload, branch = "master") {
    return request(withBranch(albumPath(owner, repo, `/stories/${encodeURIComponent(storyId)}`), branch), {
      method: "PUT",
      body: payload,
    });
  },

  async deleteStory(owner, repo, storyId, sha, branch = "master") {
    return request(withBranch(albumPath(owner, repo, `/stories/${encodeURIComponent(storyId)}`), branch), {
      method: "DELETE",
      body: { sha },
    });
  },

  async listBranches(owner, repo, page = 1) {
    return request(albumPath(owner, repo, `/branches?page=${page}`));
  },

  async createBranch(owner, repo, payload) {
    return request(albumPath(owner, repo, "/branches"), { method: "POST", body: payload });
  },

  async renameBranch(owner, repo, branch, newName) {
    return request(albumPath(owner, repo, `/branches/${encodeURIComponent(branch)}`), {
      method: "PATCH",
      body: { newName },
    });
  },

  async deleteBranch(owner, repo, branch) {
    return request(albumPath(owner, repo, `/branches/${encodeURIComponent(branch)}`), {
      method: "DELETE",
    });
  },

  async compareBranches(owner, repo, base, head) {
    return request(
      `${albumPath(owner, repo, "/compare")}?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
    );
  },

  async listBranchCommits(owner, repo, branch = "master", page = 1) {
    return request(withBranch(albumPath(owner, repo, "/branches/commits"), branch) + `&page=${page}`);
  },

  async listIssues(owner, repo, params = {}) {
    const query = new URLSearchParams({
      state: params.state || "open",
      page: String(params.page || 1),
      per_page: String(params.perPage || 20),
    });
    if (params.author) query.set("author", params.author);
    if (params.assignee) query.set("assignee", params.assignee);
    if (params.labels) query.set("labels", params.labels);
    if (params.q) query.set("q", params.q);
    return request(albumPath(owner, repo, `/issues?${query.toString()}`));
  },

  async getIssue(owner, repo, number, commentsPage = 1) {
    return request(albumPath(owner, repo, `/issues/${number}?page=${commentsPage}`));
  },

  async createIssue(owner, repo, payload) {
    return request(albumPath(owner, repo, "/issues"), { method: "POST", body: payload });
  },

  async updateIssue(owner, repo, number, payload) {
    return request(albumPath(owner, repo, `/issues/${number}`), { method: "PATCH", body: payload });
  },

  async commentOnIssue(owner, repo, number, body) {
    return request(albumPath(owner, repo, `/issues/${number}/comments`), {
      method: "POST",
      body: { body },
    });
  },

  async listPulls(owner, repo, params = {}) {
    const query = new URLSearchParams({
      state: params.state || "open",
      page: String(params.page || 1),
    });
    return request(albumPath(owner, repo, `/pulls?${query.toString()}`));
  },

  async getPull(owner, repo, number) {
    return request(albumPath(owner, repo, `/pulls/${number}`));
  },

  async createPull(owner, repo, payload) {
    return request(albumPath(owner, repo, "/pulls"), { method: "POST", body: payload });
  },

  async reviewPull(owner, repo, number, payload) {
    return request(albumPath(owner, repo, `/pulls/${number}/reviews`), {
      method: "POST",
      body: payload,
    });
  },

  async mergePull(owner, repo, number, payload = {}) {
    return request(albumPath(owner, repo, `/pulls/${number}/merge`), {
      method: "PUT",
      body: payload,
    });
  },

  async forkAlbum(owner, repo) {
    return request(albumPath(owner, repo, "/forks"), { method: "POST" });
  },

  async listForks(page = 1) {
    return request(`/api/v1/forks?page=${page}`);
  },
};

export default apiClient;
