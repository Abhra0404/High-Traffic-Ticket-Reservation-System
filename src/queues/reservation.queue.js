import { Queue } from "bullmq";
import { redis } from "./redis.js";

export async function scheduleReservationExpiration(
  reservationId,
  expiresAt
) {
  const delay = Math.max(
    expiresAt.getTime() - Date.now(),
    0
  );

  await reservationQueue.add(
    "expire-reservation",
    {
      reservationId,
    },
    {
      jobId: `reservation-expiration-${reservationId}`,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}