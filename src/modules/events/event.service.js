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
  getSeatsWithStampedeProtection,
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
  return getSeatsWithStampedeProtection(
    eventId,
    async () => {
      return db
        .select({
          id: eventSeats.id,
          seatId: eventSeats.seatId,
          price: eventSeats.price,
          status: eventSeats.status,
        })
        .from(eventSeats)
        .where(
          eq(eventSeats.eventId, eventId)
        );
    }
  );
}