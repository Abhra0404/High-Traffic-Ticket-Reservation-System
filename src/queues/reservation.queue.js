import { Queue } from "bullmq";

import { redis } from "./redis.js";

export const reservationQueue = new Queue(
  "reservation-expiration",
  {
    connection: redis,
  }
);