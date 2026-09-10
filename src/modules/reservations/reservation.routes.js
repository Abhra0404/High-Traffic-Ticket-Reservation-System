import { Router } from "express";

import {
  createReservationHandler,
  confirmReservationHandler,
  cancelReservationHandler,
} from "./reservation.controller.js";

const router = Router();

router.post(
  "/",
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