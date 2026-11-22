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

function attachRequestDetails(error, endpoint, method, stage, status) {
  const requestError = error instanceof Error ? error : new Error(String(error));
  if (stage) requestError.stage = stage;
  requestError.githubMethod = method;
  requestError.githubPath = new URL(endpoint, GITHUB_API_URL).pathname;
  if (status !== undefined) requestError.githubStatus = status;
  return requestError;
}

export function parseRetryAfterMs(header, fallbackMs, now = Date.now()) {
  if (typeof header !== "string") return fallbackMs;
  const trimmed = header.trim();
  if (!trimmed) return fallbackMs;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : fallbackMs;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isFinite(timestamp)) {
    return Math.max(0, timestamp - now);
  }
  return fallbackMs;
}

export function parseLinkHeader(header) {
  if (typeof header !== "string" || !header) return {};
  const links = {};
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

export async function githubRequest(fetchFn, endpoint, accessToken, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const { stage, ...requestOptions } = options;
  const maxAttempts = options.retry === false || method !== "GET" ? 1 : 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = /^https?:\/\//i.test(endpoint) ? endpoint : `${GITHUB_API_URL}${endpoint}`;
    const headers = {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    let response;
    try {
      response = await fetchFn(url, { ...requestOptions, headers, retry: undefined });
    } catch (error) {
      throw attachRequestDetails(error, url, method, stage);
    }
    const retryAfterHeader = response.headers.get("retry-after");
    const rateRemaining = response.headers.get("x-ratelimit-remaining");

    if (response.status === 204) {
      return { data: null, status: 204, headers: response.headers };
    }

    const data = await response.json().catch(() => null);

    if (response.status === 429 || (response.status === 403 && rateRemaining === "0")) {
      const retryAfter = parseRetryAfterMs(retryAfterHeader, 500 * 2 ** attempt);
      lastError = attachRequestDetails(
        githubError(data, response.status, "RATE_LIMITED"),
        url,
        method,
        stage,
        response.status
      );
      lastError.retryAfter = retryAfterHeader;
      if (attempt < maxAttempts) {
        await sleep(retryAfter);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      throw attachRequestDetails(
        githubError(data, response.status),
        url,
        method,
        stage,
        response.status
      );
    }

    return { data, status: response.status, headers: response.headers };
  }

  throw lastError || new Error("GitHub request failed");
}

export function githubError(data, status, code) {
  const rawMessage = typeof data?.message === "string" ? data.message.trim() : "";
  const message = rawMessage || `GitHub API request failed with status ${status}`;
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
  } else if (code) {
    err.code = code;
    if (code === "RATE_LIMITED") {
      err.userMessage = rawMessage || "GitHub API rate limit exceeded. Please try again later.";
    }
  } else if (status === 401) {
    err.code = "UNAUTHORIZED";
  } else if (status === 403) {
    err.code = "FORBIDDEN";
    err.userMessage = rawMessage || "GitHub denied this action. Check repository permissions.";
  } else if (status === 404) {
    err.code = "NOT_FOUND";
  } else if (status === 422) {
    err.code = "VALIDATION_ERROR";
  }
  return err;
}

export function resolveBranch(req) {
  const queryBranch = typeof req?.query?.branch === "string" ? req.query.branch.trim() : "";
  if (queryBranch) return queryBranch;
  const bodyBranch = typeof req?.body?.branch === "string" ? req.body.branch.trim() : "";
  return bodyBranch || undefined;
}

export async function resolveLibraryBranch(fetchFn, accessToken, owner, branch) {
  if (branch && branch !== "master") return branch;
  const { data } = await githubRequest(
    fetchFn,
    `/repos/${encodeURIComponent(owner)}/gridcraft-artworks`,
    accessToken
  );
  return data?.default_branch || branch || "master";
}
