import { logger } from "../utils/logger.js";

export function errorHandler(error, req, res, next) {
  logger.error("unhandled_error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: error.message,
    stack:
      process.env.NODE_ENV === "production"
        ? undefined
        : error.stack,
  });

  return res.status(500).json({
    error: "Internal server error",
    requestId: req.requestId,
  });
}