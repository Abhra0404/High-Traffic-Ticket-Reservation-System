import express from "express";

import eventRoutes from "./modules/events/event.routes.js";
import reservationRoutes from "./modules/reservations/reservation.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ticket-reservation-system",
  });
});

app.use("/api/events", eventRoutes);

app.use("/api/reservations", reservationRoutes);

export default app;