import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { db } from "../../db/index.js";
import {
  eventSeats,
  reservations,
  outboxEvents,
  idempotencyKeys,
} from "../../db/schema.js";

export async function createReservation({
  userId,
  eventSeatId,
  idempotencyKey,
  requestId,
}) {
  return db.transaction(async (tx) => {
    // 1. Fast idempotency check
    const existingKey = await tx
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.key, idempotencyKey)
        )
      )
      .limit(1);

    if (existingKey.length > 0) {
      const existingReservation = await tx
        .select()
        .from(reservations)
        .where(
          eq(
            reservations.id,
            existingKey[0].reservationId
          )
        )
        .limit(1);

      return existingReservation[0];
    }

    // 2. Lock the seat
    const seatResult = await tx
      .select()
      .from(eventSeats)
      .where(eq(eventSeats.id, eventSeatId))
      .for("update");

    const seat = seatResult[0];

    if (!seat) {
      throw new Error("Event seat not found");
    }

    // 3. Re-check idempotency AFTER acquiring lock
    const retryKey = await tx
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.key, idempotencyKey)
        )
      )
      .limit(1);

    if (retryKey.length > 0) {
      const existingReservation = await tx
        .select()
        .from(reservations)
        .where(
          eq(
            reservations.id,
            retryKey[0].reservationId
          )
        )
        .limit(1);

    logger.info("reservation_idempotent_replay", {
        requestId,
        userId,
        eventSeatId,
        reservationId: existingReservation.id,
    });

      return existingReservation[0];
    }

    // 4. Check seat availability
    if (seat.status !== "AVAILABLE") {
      throw new Error("Seat is not available");
    }

    // 5. Create reservation expiry
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // 6. Hold seat
    await tx
      .update(eventSeats)
      .set({
        status: "HELD",
      })
      .where(eq(eventSeats.id, eventSeatId));

    // 7. Create reservation
    const [reservation] = await tx
      .insert(reservations)
      .values({
        userId,
        eventSeatId,
        status: "PENDING",
        expiresAt,
      })
      .returning();

    // 8. Store idempotency key
    await tx
      .insert(idempotencyKeys)
      .values({
        key: idempotencyKey,
        userId,
        reservationId: reservation.id,
      });

    // 9. Create outbox event
    await tx
      .insert(outboxEvents)
      .values({
        type: "RESERVATION_EXPIRATION_SCHEDULED",
        payload: JSON.stringify({
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt,
        }),
      });
    await tx
    .insert(outboxEvents)
    .values({
      type: "SEAT_CACHE_INVALIDATE",
      payload: JSON.stringify({
        eventId: seat.eventId,
      }),
    });
    logger.info("reservation_created", {
      requestId,
      userId,
      eventSeatId,
      reservationId: reservation.id,
      expiresAt: reservation.expiresAt,
    });

    return reservation;
  });
}

export async function confirmReservation({
  reservationId,
  userId,
}) {
  return db.transaction(async (tx) => {
    // 1. Lock reservation
    const reservationResult = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .for("update");

    const reservation = reservationResult[0];

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // 2. Verify ownership
    if (reservation.userId !== userId) {
      throw new Error("Reservation does not belong to user");
    }

    // 3. Reservation must be pending
    if (reservation.status !== "PENDING") {
      throw new Error(
        `Reservation cannot be confirmed from ${reservation.status} state`
      );
    }

    // 4. Check expiration
    if (
      reservation.expiresAt &&
      reservation.expiresAt <= new Date()
    ) {
      throw new Error("Reservation has expired");
    }

    // 5. Lock seat
    const seatResult = await tx
      .select()
      .from(eventSeats)
      .where(
        eq(eventSeats.id, reservation.eventSeatId)
      )
      .for("update");

    const seat = seatResult[0];

    if (!seat) {
      throw new Error("Event seat not found");
    }

    // 6. Seat must still be held
    if (seat.status !== "HELD") {
      throw new Error("Seat is not held");
    }

    // 7. Confirm reservation
    const [confirmedReservation] = await tx
      .update(reservations)
      .set({
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, reservationId))
      .returning();

    // 8. Mark seat as sold
    await tx
      .update(eventSeats)
      .set({
        status: "SOLD",
      })
      .where(eq(eventSeats.id, reservation.eventSeatId));

    await tx
    .insert(outboxEvents)
    .values({
      type: "SEAT_CACHE_INVALIDATE",
      payload: JSON.stringify({
        eventId: seat.eventId,
      }),
    });

    return confirmedReservation;
  });
}

export async function cancelReservation({
  reservationId,
  userId,
}) {
  return db.transaction(async (tx) => {
    // 1. Lock reservation
    const reservationResult = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .for("update");

    const reservation = reservationResult[0];

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // 2. Verify ownership
    if (reservation.userId !== userId) {
      throw new Error("Reservation does not belong to user");
    }

    // 3. Validate state
    if (
      reservation.status !== "PENDING" &&
      reservation.status !== "CONFIRMED"
    ) {
      throw new Error(
        `Reservation cannot be cancelled from ${reservation.status} state`
      );
    }

    // 4. Lock seat
    const seatResult = await tx
      .select()
      .from(eventSeats)
      .where(
        eq(eventSeats.id, reservation.eventSeatId)
      )
      .for("update");

    const seat = seatResult[0];

    if (!seat) {
      throw new Error("Event seat not found");
    }

    // 5. Cancel reservation
    const [cancelledReservation] = await tx
      .update(reservations)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, reservationId))
      .returning();

    // 6. Release seat
    await tx
      .update(eventSeats)
      .set({
        status: "AVAILABLE",
      })
      .where(
        eq(
          eventSeats.id,
          reservation.eventSeatId
        )
      );

    // 7. Invalidate seat cache through outbox
    await tx
      .insert(outboxEvents)
      .values({
        type: "SEAT_CACHE_INVALIDATE",
        payload: JSON.stringify({
          eventId: seat.eventId,
        }),
      });

    return cancelledReservation;
  });
}