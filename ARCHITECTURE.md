# Architecture — High-Traffic Ticket Reservation System

## 1. Overview

The system is a modular Node.js backend designed to handle high-concurrency ticket reservations while maintaining strong consistency.

The architecture prioritizes:

1. Correctness
2. Concurrency safety
3. Performance
4. Reliability
5. Observability

The initial implementation uses a modular monolith rather than prematurely splitting the system into microservices.

---

## 2. High-Level Architecture

```text
                         Client
                           │
                           ▼
                    ┌──────────────┐
                    │   Express    │
                    │     API      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
          Events      Reservations   Health/Metrics
                           │
                ┌──────────┼──────────┐
                │          │          │
                ▼          ▼          ▼
           PostgreSQL    Redis      Outbox
                │          │          │
                │          │          ▼
                │          │       BullMQ
                │          │          │
                │          │          ▼
                │          │   Expiration Worker
                │          │
                └──────────┴──────────────┐
                                         │
                                  Prometheus
                                         │
                                         ▼
                                     Grafana
````

---

## 3. Application Structure

The backend follows a modular architecture:

```text
Request
   │
   ▼
Router
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Drizzle ORM
   │
   ▼
PostgreSQL
```

Supporting infrastructure such as Redis, BullMQ, the Outbox publisher, and observability operates alongside the core request path.

---

## 4. Reservation Flow

A reservation request follows this sequence:

```text
POST /api/reservations
        │
        ▼
Validate request
        │
        ▼
Validate Idempotency-Key
        │
        ▼
Check existing idempotency key
        │
        ├── Exists + same request
        │        └── Return existing reservation
        │
        └── New request
                 │
                 ▼
          Begin transaction
                 │
                 ▼
        Lock event seat FOR UPDATE
                 │
                 ▼
        Check seat availability
                 │
                 ▼
          Mark seat HELD
                 │
                 ▼
        Create PENDING reservation
                 │
                 ├── Store idempotency key
                 │
                 ├── Create expiration outbox event
                 │
                 └── Create cache invalidation event
                 │
                 ▼
             Commit
```

The database transaction ensures the seat state, reservation, idempotency record, and outbox events are committed atomically.

---

## 5. Concurrency Control

The database is the source of truth for seat ownership.

Reservation transactions acquire a row-level lock:

```sql
SELECT ...
FROM event_seats
WHERE id = ?
FOR UPDATE;
```

Concurrent requests targeting the same seat therefore serialize around the locked row.

Example:

```text
Request A ──┐
            ├──► Seat Row Lock ──► Reservation succeeds
Request B ──┘
                  │
                  └──► Sees HELD ──► 409 Conflict
```

Redis is not used as the authoritative locking mechanism for ticket allocation.

---

## 6. Idempotency

Each reservation request requires an `Idempotency-Key`.

The database maintains a unique constraint:

```text
(user_id, idempotency_key)
```

This provides protection against duplicate logical requests.

The system also verifies that an existing key is not reused for a different seat.

```text
Same key + same request
        │
        ▼
Return original reservation

Same key + different request
        │
        ▼
Reject with 409 Conflict
```

The idempotency check is performed before the seat operation and re-checked after acquiring the seat lock to handle concurrent requests.

---

## 7. Redis Caching

Seat availability is read frequently, so seat data is cached in Redis.

```text
GET seats
    │
    ▼
Redis
 ┌──┴──┐
 │     │
HIT   MISS
 │     │
 ▼     ▼
Return  Acquire Redis lock
          │
          ▼
       PostgreSQL
          │
          ▼
       Populate cache
```

Cached seat data has a short TTL.

When the cache is missing, a Redis lock prevents many requests from simultaneously loading the same dataset from PostgreSQL.

This protects PostgreSQL from a cache stampede.

---

## 8. Transactional Outbox

External asynchronous operations are not performed directly inside the reservation transaction.

Instead:

```text
PostgreSQL Transaction
        │
        ├── Reservation
        ├── Idempotency Key
        └── Outbox Event
                │
                ▼
             COMMIT
                │
                ▼
        Outbox Publisher
                │
                ▼
             BullMQ
```

This prevents a dual-write failure where the database commits successfully but the asynchronous operation fails.

Unprocessed outbox events remain persisted and can be retried after the publisher recovers.

---

## 9. Reservation Expiration

Temporary reservations are represented as:

```text
PENDING + expiresAt
```

When a reservation is created, an expiration event is persisted in the outbox.

The publisher schedules a delayed BullMQ job.

```text
Reservation
     │
     ▼
Outbox Event
     │
     ▼
BullMQ Delayed Job
     │
     ▼
Expiration Worker
     │
     ▼
Lock Reservation + Seat
     │
     ▼
PENDING → EXPIRED
HELD    → AVAILABLE
```

The worker performs the state transition transactionally.

---

## 10. Database Model

Core entities:

```text
Users
  │
  └── Reservations

Venues
  │
  ├── Seats
  │
  └── Events
        │
        └── Event Seats
              │
              └── Reservations

Outbox Events

Idempotency Keys
```

Important constraints and indexes protect uniqueness and improve common query paths.

---

## 11. Observability

Every HTTP request receives an `X-Request-ID`.

Structured logs include:

* request ID
* HTTP method
* path
* status
* duration
* reservation identifiers
* relevant user/event information

Prometheus collects HTTP and reservation metrics.

Grafana provides dashboards for:

* HTTP request rate
* HTTP p95 latency
* HTTP error rate
* reservation attempts
* reservation success
* reservation conflicts
* idempotent replay rate
* reservation success rate

---

## 12. Failure Boundaries

The system explicitly handles failures at several boundaries:

```text
                    ┌─────────────┐
                    │ PostgreSQL  │
                    └──────┬──────┘
                           │
                    readiness check

                    ┌─────────────┐
                    │    Redis    │
                    └──────┬──────┘
                           │
                    readiness + retry

                    ┌─────────────┐
                    │   Outbox    │
                    └──────┬──────┘
                           │
                    persistent recovery

                    ┌─────────────┐
                    │     API     │
                    └──────┬──────┘
                           │
                    graceful shutdown
```

The database remains the authoritative source for reservation state.

---

## 13. Key Design Decisions

### PostgreSQL for reservation correctness

Ticket allocation requires strong consistency, so the database is responsible for the authoritative seat state and concurrency control.

### Redis for performance

Redis is used for read caching, rate limiting, and cache-stampede protection rather than as the source of truth.

### BullMQ instead of synchronous expiration

Expiration does not need to block the reservation request. Delayed jobs move this work to an asynchronous worker.

### Outbox instead of direct external writes

The Outbox pattern guarantees that asynchronous intent is persisted together with the database state.

### Modular monolith first

The system is kept as a modular monolith to reduce distributed-system complexity while the core correctness and scalability problems are solved.

---

## 14. Scalability Direction

The current architecture can evolve toward horizontal scaling:

```text
             Load Balancer
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      API-1      API-2      API-N
        │          │          │
        └──────┬───┴──────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   PostgreSQL       Redis
        │
        ▼
      Outbox
        │
        ▼
      BullMQ
        │
   ┌────┴────┐
   ▼         ▼
Worker-1  Worker-N
```

Further scaling mechanisms such as database partitioning, distributed tracing, and cloud deployment are intentionally outside the current scope.
