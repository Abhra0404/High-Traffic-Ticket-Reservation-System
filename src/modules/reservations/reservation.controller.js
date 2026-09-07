import { z } from "zod";
import { createReservation } from "./reservation.service.js";

const reservationSchema = z.object({
  userId: z.string().uuid(),
  eventSeatId: z.string().uuid(),
});

export async function createReservationHandler(req, res) {
  try {
    const result = reservationSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.flatten(),
      });
    }

    const idempotencyKey = req.get("Idempotency-Key");

    console.log("HEADER:", JSON.stringify(idempotencyKey));

    if (!idempotencyKey || idempotencyKey.trim() === "") {
      return res.status(400).json({
        error: "Idempotency-Key header is required",
      });
    }

    const reservation = await createReservation({
      userId: result.data.userId,
      eventSeatId: result.data.eventSeatId,
      idempotencyKey: idempotencyKey.trim(),
    });

    return res.status(201).json({
      data: reservation,
    });
  } catch (error) {
    console.error("RESERVATION ERROR:", error);

    return res.status(409).json({
      error: error.message,
    });
  }
}