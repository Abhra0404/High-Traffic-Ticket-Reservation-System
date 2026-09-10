import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  events,
  venues,
  eventSeats,
  seats,
} from "../../db/schema.js";

import {
  getCachedSeats,
  cacheSeats,
} from "../seats/seat.cache.js";

export async function getAllEvents() {
  return db
    .select({
      id: events.id,
      name: events.name,
      venue: venues.name,
      startsAt: events.startsAt,
    })
    .from(events)
    .innerJoin(
      venues,
      eq(events.venueId, venues.id)
    );
}

export async function getEventById(eventId) {
  const result = await db
    .select({
      id: events.id,
      name: events.name,
      venue: venues.name,
      startsAt: events.startsAt,
    })
    .from(events)
    .innerJoin(
      venues,
      eq(events.venueId, venues.id)
    )
    .where(eq(events.id, eventId));

  return result[0] ?? null;
}

export async function getEventSeats(eventId) {
  // 1. Check Redis
  const cachedSeats = await getCachedSeats(eventId);

  if (cachedSeats) {
    console.log("Seat cache HIT");

    return cachedSeats;
  }

  console.log("Seat cache MISS");

  // 2. Query PostgreSQL
  const seats = await db
    .select()
    .from(eventSeats)
    .where(eq(eventSeats.eventId, eventId));

  // 3. Store result in Redis
  await cacheSeats(eventId, seats);

  return seats;
}