import "dotenv/config";
import { and, eq, lt } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  eventSeats,
  reservations,
} from "../../db/schema.js";

export async function expireReservations() {
  const now = new Date();

  const expiredReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.status, "PENDING"),
        lt(reservations.expiresAt, now)
      )
    );

  for (const reservation of expiredReservations) {
    await db.transaction(async (tx) => {
      // Mark reservation as expired
      await tx
        .update(reservations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(
          eq(reservations.id, reservation.id)
        );

      // Release the seat
      await tx
        .update(eventSeats)
        .set({
          status: "AVAILABLE"
        })
        .where(
          eq(eventSeats.id, reservation.eventSeatId)
        );
    });
  }

  return expiredReservations.length;
}
