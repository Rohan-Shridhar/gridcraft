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
};

export default apiClient;
