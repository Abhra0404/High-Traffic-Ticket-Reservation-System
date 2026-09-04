import { Worker } from "bullmq";

import { redis } from "./redis.js";
import { expireReservations } from "../modules/reservations/reservation.expiration.js";

const worker = new Worker(
  "reservation-expiration",
  async (job) => {
    console.log(
      `Processing expiration job: ${job.id}`
    );

    const expiredCount =
      await expireReservations();

    console.log(
      `Expired ${expiredCount} reservations`
    );

    return {
      expiredCount,
    };
  },
  {
    connection: redis,
  }
);

worker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed`
  );
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