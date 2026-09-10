import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1000,
  iterations: 1000,

  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const URL =
  "http://localhost:3000/api/events/f892bcad-6618-4205-be2f-2aabb65bd987/seats";

export default function () {
  const response = http.get(URL);

  check(response, {
    "status is 200": (r) => r.status === 200,
  });
}