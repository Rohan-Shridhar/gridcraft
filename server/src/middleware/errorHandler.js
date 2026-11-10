import { config } from "../config/env.js";

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Resource not found: ${req.method} ${req.path}`,
    },
  });
}

export function errorHandler(err, req, res, next) {
  // Never log raw sensitive errors with tokens
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message || err);

  const isZod = err?.name === "ZodError" || Array.isArray(err?.issues);
  const isBodyTooLarge = err?.type === "entity.too.large";
  const statusCode = isBodyTooLarge ? 413 : isZod ? 400 : err.status || err.statusCode || 500;
  const errorCode = isZod
    ? "VALIDATION_ERROR"
    : isBodyTooLarge
      ? "PAYLOAD_TOO_LARGE"
    : err.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");
  const zodMessage = isZod ? err.issues?.[0]?.message : null;

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: isBodyTooLarge
        ? "Request body exceeds the 2 MB limit."
        : zodMessage || err.userMessage || err.message || "An unexpected error occurred.",
      ...(config.nodeEnv === "test" && err.details ? { details: err.details } : {}),
    },
  });
}
