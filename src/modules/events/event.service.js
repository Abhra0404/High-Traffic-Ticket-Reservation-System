import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  events,
  venues,
  eventSeats,
  seats,
} from "../../db/schema.js";

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
  return db
    .select({
      eventSeatId: eventSeats.id,
      seatId: seats.id,
      section: seats.section,
      row: seats.row,
      seatNumber: seats.seatNumber,
      price: eventSeats.price,
      status: eventSeats.status,
    })
    .from(eventSeats)
    .innerJoin(
      seats,
      eq(eventSeats.seatId, seats.id)
    )
    .where(eq(eventSeats.eventId, eventId));
}