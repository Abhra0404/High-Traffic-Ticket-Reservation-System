import "dotenv/config";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

import {
  users,
  venues,
  seats,
  events,
  eventSeats,
} from "./schema.js";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function seed() {
  console.log("🌱 Starting database seed...");

  // --------------------------------------------------
  // User
  // --------------------------------------------------

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, "test@example.com"));

  let user;

  if (existingUser.length > 0) {
    user = existingUser[0];
  } else {
    [user] = await db
      .insert(users)
      .values({
        name: "Test User",
        email: "test@example.com",
      })
      .returning();
  }

  // --------------------------------------------------
  // Venue
  // --------------------------------------------------

  const existingVenues = await db
    .select()
    .from(venues);

  let venue;

  if (existingVenues.length > 0) {
    venue = existingVenues[0];
  } else {
    [venue] = await db
      .insert(venues)
      .values({
        name: "Delhi Arena",
      })
      .returning();
  }

  // --------------------------------------------------
  // Seats
  // --------------------------------------------------

  const existingSeats = await db
    .select()
    .from(seats)
    .where(eq(seats.venueId, venue.id));

  let venueSeats = existingSeats;

  if (existingSeats.length === 0) {
    const seatValues = [];

    for (let row = 1; row <= 10; row++) {
      for (let number = 1; number <= 10; number++) {
        seatValues.push({
          venueId: venue.id,
          section: "A",
          row: `R${row}`,
          seatNumber: number,
        });
      }
    }

    venueSeats = await db
      .insert(seats)
      .values(seatValues)
      .returning();
  }

  // --------------------------------------------------
  // Event
  // --------------------------------------------------

  const existingEvents = await db
    .select()
    .from(events)
    .where(eq(events.venueId, venue.id));

  let event;

  if (existingEvents.length > 0) {
    event = existingEvents[0];
  } else {
    [event] = await db
      .insert(events)
      .values({
        name: "Rock Night 2026",
        venueId: venue.id,
        startsAt: new Date("2026-12-20T19:00:00"),
      })
      .returning();
  }

  // --------------------------------------------------
  // Event Seats
  // --------------------------------------------------

  const existingEventSeats = await db
    .select()
    .from(eventSeats)
    .where(eq(eventSeats.eventId, event.id));

  if (existingEventSeats.length === 0) {
    const eventSeatValues = venueSeats.map((seat) => ({
      eventId: event.id,
      seatId: seat.id,
      price: 1500,
      status: "AVAILABLE",
    }));

    await db
      .insert(eventSeats)
      .values(eventSeatValues);
  }

  console.log("✅ Database seeded successfully!");
  console.log(`User: ${user.email}`);
  console.log(`Venue: ${venue.name}`);
  console.log(`Event: ${event.name}`);
  console.log(`Seats: ${venueSeats.length}`);

  await client.end();
}

seed().catch(async (error) => {
  console.error("❌ Seed failed:", error);

  await client.end();

  process.exit(1);
});