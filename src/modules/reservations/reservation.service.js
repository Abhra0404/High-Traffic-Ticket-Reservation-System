import { eq, and } from "drizzle-orm";

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

    return reservation;
  });
}