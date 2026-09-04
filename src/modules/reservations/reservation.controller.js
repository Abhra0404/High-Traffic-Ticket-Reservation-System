import { z } from "zod";

import {
  createReservation,
} from "./reservation.service.js";

const reservationSchema = z.object({
  userId: z.string().uuid(),
  eventSeatId: z.string().uuid(),
});

export async function createReservationHandler(req, res) {
  const result = reservationSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: result.error.flatten(),
    });
  }

  try {
    const reservation = await createReservation(
      result.data
    );

    return res.status(201).json({
      data: reservation,
    });
  } catch (error) {
    return res.status(409).json({
      error: error.message,
    });
  }
}