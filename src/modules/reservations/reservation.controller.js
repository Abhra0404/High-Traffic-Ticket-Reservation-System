import { z } from "zod";
import {
  createReservation,
  confirmReservation,
  cancelReservation,
} from "./reservation.service.js";

import {
  reservationAttemptsTotal,
  reservationSuccessTotal,
  reservationConflictsTotal,
  reservationIdempotentReplaysTotal,
} from "../../utils/reservation.metrics.js";

const reservationSchema = z.object({
  userId: z.string().uuid(),
  eventSeatId: z.string().uuid(),
});

export async function createReservationHandler(req, res) {
  reservationAttemptsTotal.inc();
  try {
    const result = reservationSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.flatten(),
      });
    }

    const idempotencyKey = req.get("Idempotency-Key");

    if (!idempotencyKey || idempotencyKey.trim() === "") {
      return res.status(400).json({
        error: "Idempotency-Key header is required",
      });
    }

    const reservation = await createReservation({
      userId: result.data.userId,
      eventSeatId: result.data.eventSeatId,
      idempotencyKey: idempotencyKey.trim(),
      requestId: req.requestId,
    });

    reservationSuccessTotal.inc();

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

export async function confirmReservationHandler(req, res) {
  try {
    const reservationId = req.params.id;

    const userId = req.body.userId;

    if (!reservationId || !userId) {
      return res.status(400).json({
        error: "reservationId and userId are required",
      });
    }

    const reservation = await confirmReservation({
      reservationId,
      userId,
    });

    return res.status(200).json({
      data: reservation,
    });
  } catch (error) {
    console.error("CONFIRMATION ERROR:", error);

    reservationConflictsTotal.inc();

    return res.status(409).json({
      error: error.message,
    });
  }
}

export async function cancelReservationHandler(req, res) {
  try {
    const reservationId = req.params.id;
    const { userId } = req.body;

    if (!reservationId || !userId) {
      return res.status(400).json({
        error: "reservationId and userId are required",
      });
    }

    const reservation = await cancelReservation({
      reservationId,
      userId,
    });

    return res.status(200).json({
      data: reservation,
    });
  } catch (error) {
    console.error("CANCELLATION ERROR:", error);

    return res.status(409).json({
      error: error.message,
    });
  }
}