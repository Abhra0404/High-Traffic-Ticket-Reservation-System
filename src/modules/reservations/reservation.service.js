import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  eventSeats,
  reservations,
  outboxEvents,
} from "../../db/schema.js";

import {
  scheduleReservationExpiration,
} from "../../queues/reservation.queue.js";

export async function createReservation({
  userId,
  eventSeatId,
}) {
  const reservation = await db.transaction(async (tx) => {

    // 1. Lock the event seat
    const seatResult = await tx
      .select()
      .from(eventSeats)
      .where(eq(eventSeats.id, eventSeatId))
      .for("update");

    const seat = seatResult[0];

    if (!seat) {
      throw new Error("Event seat not found");
    }

    // 2. Check availability
    if (seat.status !== "AVAILABLE") {
      throw new Error("Seat is not available");
    }

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // 3. Hold the seat
    await tx
      .update(eventSeats)
      .set({
        status: "HELD",
      })
      .where(eq(eventSeats.id, eventSeatId));

    // 4. Create reservation
    const [reservation] = await tx
      .insert(reservations)
      .values({
        userId,
        eventSeatId,
        status: "PENDING",
        expiresAt,
      })
      .returning();

    // 5. Create outbox event
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

  // Queue scheduling happens AFTER the DB transaction.
  await scheduleReservationExpiration(
    reservation.id,
    reservation.expiresAt
  );

  return reservation;
}