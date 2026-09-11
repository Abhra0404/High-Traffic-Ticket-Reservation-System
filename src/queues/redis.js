import IORedis from "ioredis";

export const redis = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }

      return Math.min(times * 100, 1000);
    },
  }
);

redis.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});