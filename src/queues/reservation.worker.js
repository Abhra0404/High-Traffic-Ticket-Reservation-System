import "dotenv/config";

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { redis } from "./redis.js";
import { db } from "../db/index.js";

import {
  eventSeats,
  reservations,
  outboxEvents,
} from "../db/schema.js";

const worker = new Worker(
  "reservation-expiration",
  async (job) => {
    const { reservationId } = job.data;

    console.log(
      `Processing expiration for reservation ${reservationId}`
    );

    await db.transaction(async (tx) => {
      // 1. Lock reservation
      const reservationResult = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .for("update");

      const reservation = reservationResult[0];

      if (!reservation) {
        console.log("Reservation not found");
        return;
      }

      // 2. Idempotency / state check
      if (reservation.status !== "PENDING") {
        console.log(
          `Reservation already ${reservation.status}`
        );
        return;
      }

      // 3. Lock event seat
      const seatResult = await tx
        .select()
        .from(eventSeats)
        .where(
          eq(
            eventSeats.id,
            reservation.eventSeatId
          )
        )
        .for("update");

      const seat = seatResult[0];

      if (!seat) {
        throw new Error("Event seat not found");
      }

      // 4. Expire reservation
      await tx
        .update(reservations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      // 5. Release seat
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

      // 6. Create cache invalidation event
      await tx
        .insert(outboxEvents)
        .values({
          type: "SEAT_CACHE_INVALIDATE",
          payload: JSON.stringify({
            eventId: seat.eventId,
          }),
        });
    });

    console.log(
      `Reservation ${reservationId} expired`
    );
  },
  {
    connection: redis,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Job ${job?.id} failed:`,
    error
  );
});

console.log(
  "Reservation expiration worker started"
);
