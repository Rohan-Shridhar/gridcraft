import { APP_NAME, APP_VERSION } from "../config/version.js";

const GITHUB_API_URL = "https://api.github.com";

export const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${APP_NAME}/${APP_VERSION}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseLinkHeader(header) {
  if (!header) return {};
  const links = {};
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

export async function githubRequest(fetchFn, endpoint, accessToken, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const maxAttempts = options.retry === false || method !== "GET" ? 1 : 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_URL}${endpoint}`;
    const headers = {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    const response = await fetchFn(url, { ...options, headers, retry: undefined });
    const retryAfterHeader = response.headers.get("retry-after");
    const rateRemaining = response.headers.get("x-ratelimit-remaining");

    if (response.status === 204) {
      return { data: null, status: 204, headers: response.headers };
    }

    const data = await response.json().catch(() => null);

    if (response.status === 429 || (response.status === 403 && rateRemaining === "0")) {
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 500 * 2 ** attempt;
      lastError = githubError(data, response.status, "RATE_LIMITED");
      lastError.retryAfter = retryAfterHeader;
      if (attempt < maxAttempts) {
        await sleep(retryAfter);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      throw githubError(data, response.status);
    }

    return { data, status: response.status, headers: response.headers };
  }

  throw lastError || new Error("GitHub request failed");
}

export function githubError(data, status, code) {
  const message = data?.message || `GitHub API request failed with status ${status}`;
  const err = new Error(message);
  err.status = status;
  err.githubData = data;
  const shaConflict =
    status === 409 ||
    (status === 422 && /sha/i.test(message));
  if (shaConflict) {
    err.status = 409;
    err.code = "CONFLICT";
    err.userMessage =
      "Stale write detected. The remote file has been modified since it was loaded.";
  } else if (status === 401) {
    err.code = "UNAUTHORIZED";
  } else if (status === 403) {
    err.code = "FORBIDDEN";
    err.userMessage = data?.message || "GitHub denied this action. Check repository permissions.";
  } else if (status === 404) {
    err.code = "NOT_FOUND";
  } else if (status === 422) {
    err.code = "VALIDATION_ERROR";
  } else if (code) {
    err.code = code;
  }
  return err;
}

export function resolveBranch(req) {
  return (
    (typeof req.query?.branch === "string" && req.query.branch) ||
    (typeof req.body?.branch === "string" && req.body.branch) ||
    undefined
  );
}

export async function resolveLibraryBranch(fetchFn, accessToken, owner, branch) {
  if (branch && branch !== "master") return branch;
  const { data } = await githubRequest(
    fetchFn,
    `/repos/${encodeURIComponent(owner)}/gridcraft-artworks`,
    accessToken
  );
  return data.default_branch || branch || "master";
}
