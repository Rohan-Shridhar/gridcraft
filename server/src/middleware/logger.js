const SENSITIVE_QUERY_PARAMS = new Set(["code", "state", "token", "access_token", "secret"]);
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-hub-signature-256",
  "x-github-token",
]);

/**
 * Sanitizes an URL query string or object to ensure secrets are never printed.
 */
export function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, "http://localhost");
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.pathname + (parsed.search ? parsed.search : "");
  } catch {
    return "[MALFORMED_URL]";
  }
}

/**
 * Sanitizes headers object by masking tokens, authorization, and cookies.
 */
export function sanitizeHeaders(headers = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  const sanitizedPath = sanitizeUrl(req.originalUrl || req.url);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    // Format: [TIMESTAMP] METHOD /sanitized/path STATUS DURATIONms
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${method} ${sanitizedPath} ${statusCode} - ${duration}ms`);
  });

  next();
}
