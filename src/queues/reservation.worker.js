import "dotenv/config";

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { redis } from "./redis.js";
import { db } from "../db/index.js";
import {
  eventSeats,
  reservations,
} from "../db/schema.js";

const worker = new Worker(
  "reservation-expiration",
  async (job) => {
    const { reservationId } = job.data;

    console.log(
      `Processing expiration for reservation ${reservationId}`
    );

    await db.transaction(async (tx) => {
      const result = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .for("update");

      const reservation = result[0];

      if (!reservation) {
        console.log("Reservation not found");
        return;
      }

      // Idempotency check
      if (reservation.status !== "PENDING") {
        console.log(
          `Reservation already ${reservation.status}`
        );
        return;
      }

      await tx
        .update(reservations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      await tx
        .update(eventSeats)
        .set({
          status: "AVAILABLE",
        })
        .where(eq(eventSeats.id, reservation.eventSeatId));
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

console.log("Reservation expiration worker started");