import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

/* ----------------------------- Enums ----------------------------- */

export const eventSeatStatus = pgEnum("event_seat_status", [
  "AVAILABLE",
  "HELD",
  "SOLD",
]);

export const reservationStatus = pgEnum("reservation_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);

/* ----------------------------- Users ----------------------------- */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", {
    length: 255,
  }).notNull(),

  email: varchar("email", {
    length: 255,
  }).notNull().unique(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

/* ----------------------------- Venues ----------------------------- */

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", {
    length: 255,
  }).notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

/* ----------------------------- Seats ----------------------------- */

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, {
        onDelete: "cascade",
      }),

    section: varchar("section", {
      length: 50,
    }).notNull(),

    row: varchar("row", {
      length: 10,
    }).notNull(),

    seatNumber: integer("seat_number").notNull(),
  },
  (table) => ({
    uniqueSeat: unique().on(
      table.venueId,
      table.section,
      table.row,
      table.seatNumber
    ),
  })
);

/* ----------------------------- Events ----------------------------- */

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", {
    length: 255,
  }).notNull(),

  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, {
      onDelete: "cascade",
    }),

  startsAt: timestamp("starts_at").notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

/* -------------------------- Event Seats -------------------------- */

export const eventSeats = pgTable(
  "event_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
      }),

    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id, {
        onDelete: "cascade",
      }),

    price: integer("price").notNull(),

    status: eventSeatStatus("status")
      .default("AVAILABLE")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueEventSeat: unique().on(
      table.eventId,
      table.seatId
    ),
  })
);

/* -------------------------- Reservations -------------------------- */

export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  eventSeatId: uuid("event_seat_id")
    .notNull()
    .references(() => eventSeats.id, {
      onDelete: "cascade",
    }),

  status: reservationStatus("status")
    .default("PENDING")
    .notNull(),

  expiresAt: timestamp("expires_at"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  type: varchar("type", { length: 100 }).notNull(),

  payload: varchar("payload", { length: 1000 }).notNull(),

  processedAt: timestamp("processed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});