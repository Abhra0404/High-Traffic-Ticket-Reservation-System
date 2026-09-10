import { Router } from "express";

import { rateLimit } from "../../middleware/rate-limit.js";

import {
  createReservationHandler,
  confirmReservationHandler,
  cancelReservationHandler,
} from "./reservation.controller.js";

const router = Router();

const reservationRateLimit = rateLimit({
  limit: 100,
  windowSeconds: 60,
  keyGenerator: (req) => req.body?.userId,
});

router.post(
  "/",
  reservationRateLimit,
  createReservationHandler
);

router.post(
  "/:id/confirm",
  confirmReservationHandler
);

router.post(
  "/:id/cancel",
  cancelReservationHandler
);

export default router;