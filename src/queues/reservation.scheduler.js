import { reservationQueue } from "./reservation.queue.js";

await reservationQueue.upsertJobScheduler(
  "reservation-expiration-scheduler",
  {
    every: 60_000,
  },
  {
    name: "expire-reservations",
    data: {},
  }
);

console.log(
  "Reservation expiration scheduler started"
);