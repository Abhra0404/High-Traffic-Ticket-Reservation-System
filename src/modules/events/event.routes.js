import { Router } from "express";

import {
  listEvents,
  getEvent,
  listEventSeats,
} from "./event.controller.js";

const router = Router();

router.get("/", listEvents);

router.get("/:id", getEvent);

router.get("/:id/seats", listEventSeats);

export default router;