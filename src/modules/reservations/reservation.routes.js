import { Router } from "express";

import {
  createReservationHandler,
} from "./reservation.controller.js";

const router = Router();

router.post(
  "/",
  createReservationHandler
);

export default router;