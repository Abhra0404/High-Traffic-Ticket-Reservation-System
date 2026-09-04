import { eq, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  eventSeats,
  reservations,
} from "../../db/schema.js";

export async function createReservation({
  userId,
  eventSeatId,
}) {
  return db.transaction(async (tx) => {
    // 1. Lock the event seat row
    const seatResult = await tx
      .select()
      .from(eventSeats)
      .where(eq(eventSeats.id, eventSeatId))
      .for("update");

    const seat = seatResult[0];

    if (!seat) {
      throw new Error("Event seat not found");
    }

    // 2. Check availability while holding the lock
    if (seat.status !== "AVAILABLE") {
      throw new Error("Seat is not available");
    }

    const holdExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // 3. Mark the seat as held
    await tx
      .update(eventSeats)
      .set({
        status: "HELD",
        holdExpiresAt,
      })
      .where(eq(eventSeats.id, eventSeatId));

    // 4. Create the reservation
    const [reservation] = await tx
      .insert(reservations)
      .values({
        userId,
        eventSeatId,
        status: "PENDING",
        expiresAt: holdExpiresAt,
      })
      .returning();

    return reservation;
  });
}