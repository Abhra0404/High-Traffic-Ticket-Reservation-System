import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 500,
  iterations: 500,
  thresholds: {
    http_req_duration: ["p(95)<1000"],
  },
};

const BASE_URL = "http://localhost:3000";

const USER_ID = "76b37253-0e0e-4c4f-8f49-a29abe9c4806";
const EVENT_ID = "e0d4b62e-3971-4842-877a-994eeacadde5";

export function setup() {
  const response = http.get(
    `${BASE_URL}/api/events/${EVENT_ID}/seats`
  );

  check(response, {
    "seat list status is 200": (r) => r.status === 200,
  });

  const seats = response.json("data");

  const availableSeats = seats
    .filter((seat) => seat.status === "AVAILABLE")
    .slice(0, 100);

  if (availableSeats.length < 100) {
    throw new Error(
      `Expected 100 available seats, got ${availableSeats.length}`
    );
  }

  return {
    eventSeats: availableSeats.map((seat) => seat.id),
  };
}

export default function (data) {
  // First 100 VUs get unique seats.
  // Remaining VUs intentionally compete for those same seats.
  const seatIndex = (__VU - 1) % data.eventSeats.length;

  const eventSeatId = data.eventSeats[seatIndex];

  const response = http.post(
    `${BASE_URL}/api/reservations`,
    JSON.stringify({
      userId: USER_ID,
      eventSeatId,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key":
          `stress-${__VU}-${__ITER}`,
      },
    }
  );

  check(response, {
  "reservation accepted or rejected correctly": (r) => {
    if (r.status !== 201 && r.status !== 409) {
      console.log(`UNEXPECTED STATUS: ${r.status} BODY: ${r.body}`);
    }

    return r.status === 201 || r.status === 409;
  },
})}