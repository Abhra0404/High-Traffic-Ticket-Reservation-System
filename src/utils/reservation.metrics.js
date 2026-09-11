import client from "prom-client";

export const reservationAttemptsTotal =
  new client.Counter({
    name: "reservation_attempts_total",
    help: "Total number of reservation attempts",
  });

export const reservationSuccessTotal =
  new client.Counter({
    name: "reservation_success_total",
    help: "Total number of successful reservations",
  });

export const reservationConflictsTotal =
  new client.Counter({
    name: "reservation_conflicts_total",
    help: "Total number of reservation conflicts",
  });

export const reservationIdempotentReplaysTotal =
  new client.Counter({
    name: "reservation_idempotent_replays_total",
    help: "Total number of idempotent reservation replays",
  });