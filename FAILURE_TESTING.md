# Failure Testing — High-Traffic Ticket Reservation System

## Overview

This document describes the failure and recovery tests performed against the ticket reservation backend.

The tests validate:

- PostgreSQL failure and recovery
- Redis failure and recovery
- API process failure and recovery
- Outbox publisher failure and recovery

The objective is to verify that committed state is preserved and the system can return to normal operation after failures.

---

## Prerequisites

Start the infrastructure:

```bash
docker compose up -d
````

Verify containers:

```bash
docker ps
```

Start the API:

```bash
npm run dev
```

Check API liveness:

```bash
curl http://localhost:3000/health/live
```

Check dependency readiness:

```bash
curl http://localhost:3000/health/ready
```

Expected:

```json
{
  "status": "ready",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok"
  }
}
```

---

# 1. PostgreSQL Failure & Recovery

## Stop PostgreSQL

```bash
docker stop ticket-postgres
```

Check readiness:

```bash
curl -i http://localhost:3000/health/ready
```

Expected:

```text
HTTP/1.1 503 Service Unavailable
```

The API should report that the service is not ready.

## Restart PostgreSQL

```bash
docker start ticket-postgres
```

Check container:

```bash
docker ps
```

Check readiness again:

```bash
curl -i http://localhost:3000/health/ready
```

Expected:

```text
HTTP/1.1 200 OK
```

**Result: Passed**

---

# 2. Redis Failure & Recovery

## Stop Redis

```bash
docker stop ticket-redis
```

Check readiness:

```bash
curl -i http://localhost:3000/health/ready
```

Expected:

```text
HTTP/1.1 503 Service Unavailable
```

Check API logs:

```text
Redis connection closed
```

## Restart Redis

```bash
docker start ticket-redis
```

Watch the API logs.

Expected connection lifecycle:

```text
Redis connected
Redis ready
```

Check readiness:

```bash
curl -i http://localhost:3000/health/ready
```

Expected:

```text
HTTP/1.1 200 OK
```

**Result: Passed**

---

# 3. API Process Failure & Recovery

First verify the API is running:

```bash
curl http://localhost:3000/health/ready
```

Create a reservation using a valid seeded user and event-seat ID:

```bash
curl -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: failure-test-1" \
  -d '{
    "userId": "YOUR_USER_ID",
    "eventSeatId": "YOUR_EVENT_SEAT_ID"
  }'
```

Save the returned reservation ID.

## Verify reservation in PostgreSQL

```bash
docker exec ticket-postgres psql \
  -U postgres \
  -d ticket_system \
  -c "SELECT id, status, expires_at FROM reservations;"
```

Verify the seat:

```bash
docker exec ticket-postgres psql \
  -U postgres \
  -d ticket_system \
  -c "SELECT id, status FROM event_seats WHERE id = 'YOUR_EVENT_SEAT_ID';"
```

Expected:

```text
Reservation: PENDING
Seat:        HELD
```

## Stop the API

Find the API process:

```bash
lsof -i :3000
```

Stop it:

```bash
kill <PID>
```

Or stop the running `npm run dev` process with:

```text
Ctrl+C
```

The reservation should still exist in PostgreSQL.

Verify:

```bash
docker exec ticket-postgres psql \
  -U postgres \
  -d ticket_system \
  -c "SELECT id, status FROM reservations;"
```

## Restart API

```bash
npm run dev
```

Check readiness:

```bash
curl http://localhost:3000/health/ready
```

Expected:

```text
200 OK
```

The previously committed reservation state should remain intact.

**Result: Passed**

---

# 4. Outbox Publisher Failure & Recovery

The Outbox publisher is responsible for processing persisted asynchronous events.

## Start the publisher

In a separate terminal:

```bash
npm run outbox
```

Stop it with:

```text
Ctrl+C
```

## Create a reservation while publisher is stopped

```bash
curl -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: outbox-failure-test-1" \
  -d '{
    "userId": "YOUR_USER_ID",
    "eventSeatId": "YOUR_EVENT_SEAT_ID"
  }'
```

The reservation transaction should still succeed because the asynchronous work is persisted in the Outbox.

## Inspect pending events

```bash
docker exec ticket-postgres psql \
  -U postgres \
  -d ticket_system \
  -c "SELECT id, type, processed_at, claimed_at FROM outbox_events ORDER BY created_at DESC;"
```

Expected for pending events:

```text
processed_at
-------------
NULL
```

Typical events include:

```text
RESERVATION_EXPIRATION_SCHEDULED
SEAT_CACHE_INVALIDATE
```

## Restart the publisher

```bash
npm run outbox
```

The publisher should process the pending events.

Expected logs:

```text
Published outbox event <id>
Processed <count> outbox events
```

Verify the database:

```bash
docker exec ticket-postgres psql \
  -U postgres \
  -d ticket_system \
  -c "SELECT id, type, processed_at FROM outbox_events ORDER BY created_at DESC;"
```

Processed events should now have a timestamp in:

```text
processed_at
```

**Result: Passed**

---

# 5. Full Recovery Verification

After completing the failure tests, verify the complete stack:

```bash
docker ps
```

Check API:

```bash
curl http://localhost:3000/health/live
```

Check dependencies:

```bash
curl http://localhost:3000/health/ready
```

Check events:

```bash
curl http://localhost:3000/api/events
```

Check seats:

```bash
curl http://localhost:3000/api/events/YOUR_EVENT_ID/seats
```

Check metrics:

```bash
curl http://localhost:3000/metrics
```

Expected:

* PostgreSQL running
* Redis running
* API running
* Readiness returns `200`
* Events endpoint responds
* Seats endpoint responds
* Metrics endpoint responds
* Pending Outbox events are processed

---

# 6. Test Summary

| Component        | Failure             | Recovery          | Result |
| ---------------- | ------------------- | ----------------- | ------ |
| PostgreSQL       | `docker stop`       | `docker start`    | Passed |
| Redis            | `docker stop`       | `docker start`    | Passed |
| API              | Process termination | API restart       | Passed |
| Outbox Publisher | Process stopped     | Publisher restart | Passed |

---

## Key Findings

### PostgreSQL

The API correctly reports an unhealthy dependency when PostgreSQL is unavailable. Committed reservation data survives API failures because it is persisted in PostgreSQL.

### Redis

Redis failures are detected through readiness checks. The Redis client continuously retries the connection and recovers after Redis becomes available.

### API

Application process failure does not remove committed reservation state.

### Outbox

Asynchronous operations are persisted before publication. If the publisher is unavailable, events remain in PostgreSQL and are processed after the publisher recovers.

---

## Recovery Model

```text
Failure
   │
   ▼
Component unavailable
   │
   ▼
Failure detected
   │
   ├── Readiness reports unhealthy
   │
   └── Persistent state remains intact
             │
             ▼
       Component recovers
             │
             ▼
       Processing resumes
             │
             ▼
        Normal operation
```

The PostgreSQL database remains the source of truth for reservation state, while the Outbox provides durable recovery for asynchronous operations.

