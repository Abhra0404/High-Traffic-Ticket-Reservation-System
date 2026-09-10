import { redis } from "../queues/redis.js";

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])

if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end

return current
`;

export function rateLimit({
  limit = 100,
  windowSeconds = 60,
  keyGenerator,
}) {
  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);

      if (!identifier) {
        return res.status(400).json({
          error: "Rate limit identifier is required",
        });
      }

      const windowId = Math.floor(
        Date.now() / (windowSeconds * 1000)
      );

      const key =
        `rate-limit:${identifier}:${windowId}`;

      const count = await redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        key,
        windowSeconds
      );

      res.setHeader(
        "X-RateLimit-Limit",
        limit
      );

      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(limit - count, 0)
      );

      if (count > limit) {
        return res.status(429).json({
          error: "Too many requests",
        });
      }

      next();
    } catch (error) {
      console.error(
        "RATE LIMIT ERROR:",
        error
      );

      // Fail open: don't make Redis failure
      // take down the booking API.
      next();
    }
  };
}