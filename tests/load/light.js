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

export default function () {
  const response = http.get(
    `${BASE_URL}/api/test-light`
  );

  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.1);
}