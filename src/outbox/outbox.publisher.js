import "dotenv/config";

import { eq, isNull } from "drizzle-orm";

import { db } from "../db/index.js";
import { outboxEvents } from "../db/schema.js";
import { scheduleReservationExpiration } from "../queues/reservation.queue.js";

async function publishOutboxEvents() {
  const events = await db.transaction(async (tx) => {
    return tx
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.processedAt))
      .limit(100)
      .for("update", { skipLocked: true });
  });

  for (const event of events) {
    try {
      const payload = JSON.parse(event.payload);

      if (event.type === "RESERVATION_EXPIRATION_SCHEDULED") {
        await scheduleReservationExpiration(
          payload.reservationId,
          new Date(payload.expiresAt)
        );
      }

      await db
        .update(outboxEvents)
        .set({
          processedAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id));

      console.log(`Published outbox event ${event.id}`);
    } catch (error) {
      console.error(
        `Failed to publish outbox event ${event.id}:`,
        error
      );
    }
  }
}

publishOutboxEvents()
  .then(() => {
    console.log("Outbox publisher finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Outbox publisher failed:", error);
    process.exit(1);
  });