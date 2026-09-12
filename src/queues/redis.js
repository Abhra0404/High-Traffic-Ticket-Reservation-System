import IORedis from "ioredis";
import { env } from "../config/env.js";

export const redis = new IORedis(env.REDIS_URL,{
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