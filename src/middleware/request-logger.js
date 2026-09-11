import { logger } from "../utils/logger.js";
import {
  httpRequestsTotal,
  httpRequestDuration,
} from "../utils/metrics.js";

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds =
      Number(process.hrtime.bigint() - start) /
      1_000_000_000;

    const route = req.route?.path || req.path;
    const status = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status,
      },
      durationSeconds
    );

    logger.info("http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(
        (durationSeconds * 1000).toFixed(2)
      ),
    });
  });

  next();
}