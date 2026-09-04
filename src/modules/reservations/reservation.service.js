import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  eventSeats,
  reservations,
} from "../../db/schema.js";

export async function createReservation({
  userId,
  eventSeatId,
}) {
  // 1. Find the seat
  const seatResult = await db
    .select()
    .from(eventSeats)
    .where(eq(eventSeats.id, eventSeatId));

  const seat = seatResult[0];

  if (!seat) {
    throw new Error("Event seat not found");
  }

  // 2. Check availability
  if (seat.status !== "AVAILABLE") {
    throw new Error("Seat is not available");
  }

  // 3. Mark seat as held
  await db
    .update(eventSeats)
    .set({
      status: "HELD",
      holdExpiresAt: new Date(
        Date.now() + 10 * 60 * 1000
      ),
    })
    .where(eq(eventSeats.id, eventSeatId));

  // 4. Create reservation
  const [reservation] = await db
    .insert(reservations)
    .values({
      userId,
      eventSeatId,
      status: "PENDING",
      expiresAt: new Date(
        Date.now() + 10 * 60 * 1000
      ),
    })
    .returning();

  return reservation;
}