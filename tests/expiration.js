const USER_ID = "c167ab58-3f79-421a-927d-07708a0b69cd";
const EVENT_SEAT_ID = "56024f0f-a569-4fcb-8f8c-063fc5d68830";

async function main() {
  // Create a reservation
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

  const reservation = await response.json();

  console.log("Reservation created:");
  console.log(reservation);

  console.log(
    "\nNow manually expire it in PostgreSQL."
  );
}

main();