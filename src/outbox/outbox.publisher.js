import "dotenv/config";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "../db/index.js";
import { outboxEvents } from "../db/schema.js";
import { scheduleReservationExpiration } from "../queues/reservation.queue.js";

const BATCH_SIZE = 100;
const CLAIM_TIMEOUT_MS = 60 * 1000;
const POLL_INTERVAL_MS = 1000;

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

  return events.length;
}

async function startPublisher() {
  console.log("Outbox publisher started");

  while (true) {
    try {
      const count = await publishOutboxEvents();

      if (count > 0) {
        console.log(`Processed ${count} outbox events`);
      }
    } catch (error) {
      console.error("Outbox polling error:", error);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, POLL_INTERVAL_MS)
    );
  }
}

startPublisher();