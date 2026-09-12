import app from "./app.js";
import { closeDatabase } from "./db/index.js";
import { redis } from "./queues/redis.js";
import { env } from "./config/env.js";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    console.log("HTTP server closed");

    try {
      await redis.quit();
      console.log("Redis connection closed");

      await closeDatabase();
      console.log("Database connection closed");

      process.exit(0);
    } catch (error) {
      console.error(
        "Shutdown error:",
        error
      );

      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));