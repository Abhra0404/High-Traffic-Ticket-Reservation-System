import express from "express";
import { db } from "./db/index.js";
import { redis } from "./queues/redis.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import eventRoutes from "./modules/events/event.routes.js";
import reservationRoutes from "./modules/reservations/reservation.routes.js";

const app = express();

app.use(express.json());
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

export default app;