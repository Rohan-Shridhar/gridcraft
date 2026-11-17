const CACHE_KEY = "gridcraft:contributors";
const CACHE_TTL = 5 * 60 * 1000;
const CONTRIBUTORS_API =
  "https://api.github.com/repos/rohan-shridhar/gridcraft/contributors?per_page=100";

export function createContributorsLoader({
  fetchImpl = fetch,
  storage,
  now = Date.now,
} = {}) {
  let pending;

  function getStorage() {
    try {
      return storage === undefined ? sessionStorage : storage;
    } catch {
      return null;
    }
  }

  return function loadContributors() {
    const cacheStorage = getStorage();
    try {
      const cached = JSON.parse(cacheStorage?.getItem(CACHE_KEY) ?? "null");
      const age = now() - cached?.timestamp;
      if (
        Number.isFinite(cached?.timestamp) &&
        Array.isArray(cached?.contributors) &&
        age >= 0 &&
        age < CACHE_TTL
      ) {
        return Promise.resolve(cached.contributors);
      }
    } catch {
      // Invalid or unavailable storage should not prevent a network request.
    }

    if (pending) return pending;

    pending = (async () => {
      const response = await fetchImpl(CONTRIBUTORS_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        const error = new Error(`GitHub API responded with ${response.status}`);
        error.rateLimited =
          response.status === 429 ||
          (response.status === 403 &&
            response.headers.get("x-ratelimit-remaining") === "0");
        throw error;
      }
      const contributors = await response.json();
      if (!Array.isArray(contributors))
        throw new Error("Invalid contributors response");
      try {
        cacheStorage?.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: now(), contributors })
        );
      } catch {
        // The fetched list remains usable when storage cannot be written.
      }
      return contributors;
    })().finally(() => {
      pending = null;
    });

    return pending;
  };
}

export const loadContributors = createContributorsLoader();
