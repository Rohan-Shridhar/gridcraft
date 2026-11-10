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

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.userMessage || err.message || "An unexpected error occurred.",
      ...(config.nodeEnv === "test" && err.details ? { details: err.details } : {}),
    },
  });
}
