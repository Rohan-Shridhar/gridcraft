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
  if (res.headersSent) {
    return next(err);
  }

  const errorObj = err && typeof err === "object" ? err : {};
  // Never log raw sensitive errors with tokens
  console.error(`[ERROR] ${req.method} ${req.path}:`, errorObj.message || err);

  const isZod = errorObj.name === "ZodError" || Array.isArray(errorObj.issues);
  const isBodyTooLarge = errorObj.type === "entity.too.large";
  const rawStatus = errorObj.status ?? errorObj.statusCode;
  const normalizedStatus =
    Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const statusCode = isBodyTooLarge ? 413 : isZod ? 400 : normalizedStatus;
  const errorCode = isZod
    ? "VALIDATION_ERROR"
    : isBodyTooLarge
      ? "PAYLOAD_TOO_LARGE"
    : errorObj.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");
  const zodMessage = isZod ? errorObj.issues?.[0]?.message : null;

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: isBodyTooLarge
        ? "Request body exceeds the 2 MB limit."
        : zodMessage || errorObj.userMessage || errorObj.message || "An unexpected error occurred.",
      ...(errorObj.installUrl ? { installUrl: errorObj.installUrl } : {}),
      ...(config.nodeEnv === "test" && errorObj.details ? { details: errorObj.details } : {}),
    },
  });
}
