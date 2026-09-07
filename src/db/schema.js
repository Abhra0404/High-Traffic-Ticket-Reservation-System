import "dotenv/config";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "../db/index.js";
import { outboxEvents } from "../db/schema.js";
import { scheduleReservationExpiration } from "../queues/reservation.queue.js";

const BATCH_SIZE = 100;
const CLAIM_TIMEOUT_MS = 60 * 1000;

async function claimOutboxEvents() {
  const now = new Date();

  const staleClaimTime = new Date(
    Date.now() - CLAIM_TIMEOUT_MS
  );

  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(outboxEvents)
      .where(
        and(
          isNull(outboxEvents.processedAt),
          or(
            isNull(outboxEvents.claimedAt),
            lt(outboxEvents.claimedAt, staleClaimTime)
          )
        )
      )
      .limit(BATCH_SIZE)
      .for("update", {
        skipLocked: true,
      });

    for (const event of events) {
      await tx
        .update(outboxEvents)
        .set({
          claimedAt: now,
        })
        .where(eq(outboxEvents.id, event.id));
    }

    return events;
  });
}

async function publishOutboxEvents() {
  const events = await claimOutboxEvents();

  console.log(`Claimed ${events.length} outbox events`);

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