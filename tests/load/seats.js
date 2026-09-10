import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1000,
  duration: "30s",

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const BASE_URL = "http://localhost:3000";

const EVENT_ID =
  "f892bcad-6618-4205-be2f-2aabb65bd987";

export default function () {
  const response = http.get(
    `${BASE_URL}/api/events/${EVENT_ID}/seats`
  );

  check(response, {
    "status is 200": (r) => r.status === 200,
    "response has data": (r) => {
      try {
        return r.json("data") !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}