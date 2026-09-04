const USER_ID = "c167ab58-3f79-421a-927d-07708a0b69cd";
const EVENT_SEAT_ID = "1e54fbad-9fed-4b1b-a4cc-77a73d4fbcd9";

const TOTAL_REQUESTS = 50;

async function attemptReservation(index) {
  try {
    const response = await fetch(
      "http://localhost:3000/api/reservations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: USER_ID,
          eventSeatId: EVENT_SEAT_ID,
        }),
      }
    );

    const body = await response.json();

    return {
      index,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      index,
      error: error.message,
    };
  }
}

async function main() {
  console.log(
    `🔥 Sending ${TOTAL_REQUESTS} concurrent requests...`
  );

  const requests = Array.from(
    { length: TOTAL_REQUESTS },
    (_, index) => attemptReservation(index)
  );

  const results = await Promise.all(requests);

  const successful = results.filter(
    (result) => result.status === 201
  );

  const rejected = results.filter(
    (result) => result.status === 409
  );

  console.log("\n========== RESULTS ==========\n");

  console.log(
    `Total requests: ${results.length}`
  );

  console.log(
    `Successful: ${successful.length}`
  );

  console.log(
    `Rejected: ${rejected.length}`
  );

  console.log("\nSuccessful reservations:");

  successful.forEach((result) => {
    console.log(
      result.index,
      result.body.data?.id
    );
  });
}

main();