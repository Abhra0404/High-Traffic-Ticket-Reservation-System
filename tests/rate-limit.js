const URL = "http://localhost:3000/api/test-rate-limit";

const TOTAL_REQUESTS = 110;

const results = await Promise.all(
  Array.from({ length: TOTAL_REQUESTS }, async () => {
    const response = await fetch(URL);

    return {
      status: response.status,
      remaining: response.headers.get(
        "X-RateLimit-Remaining"
      ),
    };
  })
);

const allowed = results.filter(
  (result) => result.status === 200
);

const rejected = results.filter(
  (result) => result.status === 429
);

console.log(`Total requests: ${TOTAL_REQUESTS}`);
console.log(`Allowed: ${allowed.length}`);
console.log(`Rejected: ${rejected.length}`);