import IORedis from "ioredis";

export const redis = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: 1,

    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  }
);

redis.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

redis.on("close", () => {
  console.log("Redis connection closed");
});