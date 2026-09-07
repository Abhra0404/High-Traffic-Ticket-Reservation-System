const URL = "http://localhost:3000/api/reservations";

const userId =
  "c167ab58-3f79-421a-927d-07708a0b69cd";

const eventSeatId =
  "595e0a43-f36f-4784-96fd-9ef5d344df6d";

const idempotencyKey =
  `concurrent-test-${Date.now()}`;

const TOTAL_REQUESTS = 50;

async function makeReservation() {
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      userId,
      eventSeatId,
    }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

const results = await Promise.all(
  Array.from(
    { length: TOTAL_REQUESTS },
    makeReservation
  )
);

const successful = results.filter(
  (result) => result.status === 201
);

const failed = results.filter(
  (result) => result.status !== 201
);

const reservationIds = successful.map(
  (result) => result.body.data?.id
);

const uniqueReservationIds =
  new Set(reservationIds);

console.log(`Total requests: ${TOTAL_REQUESTS}`);
console.log(`Successful: ${successful.length}`);
console.log(`Rejected: ${failed.length}`);
console.log(
  `Unique reservation IDs: ${uniqueReservationIds.size}`
);

console.log(
  "Reservation IDs:",
  [...uniqueReservationIds]
);