import express from "express";
import { db } from "./db/index.js";
import { redis } from "./queues/redis.js";
import { register } from "./utils/metrics.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import eventRoutes from "./modules/events/event.routes.js";
import reservationRoutes from "./modules/reservations/reservation.routes.js";

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(requestId);
app.use(requestLogger);

app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ticket-reservation-system",
  });
});

app.get("/health/ready", async (req, res) => {
  try {
    await db.execute("SELECT 1");
    await redis.ping();

    return res.status(200).json({
      status: "ready",
      dependencies: {
        postgres: "ok",
        redis: "ok",
      },
    });
  } catch (error) {
    console.error("READINESS CHECK FAILED:", error.message);

    return res.status(503).json({
      status: "not_ready",
    });
  }
});

app.use("/api/events", eventRoutes);

app.use("/api/reservations", reservationRoutes);

app.get("/metrics", async (req, res) => {
  try {
    res.set(
      "Content-Type",
      register.contentType
    );

    res.end(await register.metrics());
  } catch (error) {
    console.error("METRICS ERROR:", error);

    res.status(500).end();
  }
});

app.use(errorHandler);

export default app;