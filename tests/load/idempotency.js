import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 50,
  iterations: 50,
};

const BASE_URL = "http://localhost:3000";

const USER_ID =
  "eb5016ed-b0d2-440a-a0dd-2eba93263aa9";

const EVENT_SEAT_ID =
  "7873534d-2249-4234-888e-724fa39c6a02";

const IDEMPOTENCY_KEY = "idempotency-concurrent-test";

export default function () {
  const response = http.post(
    `${BASE_URL}/api/reservations`,
    JSON.stringify({
      userId: USER_ID,
      eventSeatId: EVENT_SEAT_ID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": IDEMPOTENCY_KEY,
      },
    }
  );

  check(response, {
    "status is 201": (r) => r.status === 201,
    "response contains reservation": (r) => {
      try {
        return Boolean(r.json("data.id"));
      } catch {
        return false;
      }
    },
  });
}