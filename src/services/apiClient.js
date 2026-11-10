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

  // Albums API
  async listAlbums(page = 1, perPage = 30) {
    return request(`/api/v1/albums?page=${page}&per_page=${perPage}`);
  },

  async createAlbum(payload) {
    return request("/api/v1/albums", {
      method: "POST",
      body: payload,
    });
  },

  async getAlbum(owner, repo) {
    return request(`/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  },

  async updateAlbum(owner, repo, payload) {
    return request(`/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deleteAlbum(owner, repo, confirmName) {
    return request(`/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: "DELETE",
      body: { confirmName },
    });
  },

  async getAlbumCommits(owner, repo, branch = "master") {
    return request(
      `/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?branch=${encodeURIComponent(branch)}`
    );
  },

  async getAlbumTree(owner, repo, branch = "master") {
    return request(
      `/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?branch=${encodeURIComponent(branch)}`
    );
  },

  async initializeExistingRepo(owner, repo) {
    return request(
      `/api/v1/albums/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/initialize`,
      { method: "POST" }
    );
  },
};

export default apiClient;
