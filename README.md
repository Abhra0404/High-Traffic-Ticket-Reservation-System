# High-Traffic Ticket Reservation System

A concurrency-safe ticket reservation backend designed to handle high traffic while preventing double-booking and maintaining reliable asynchronous workflows.

The project focuses on a realistic reservation problem:

> How do you safely allocate limited inventory when hundreds of clients attempt to reserve the same resources concurrently?

## Highlights

- PostgreSQL transactions and row-level locking
- Double-booking prevention under high contention
- Idempotent reservation requests
- Redis seat caching
- Redis cache-stampede protection
- Redis-backed rate limiting
- BullMQ delayed expiration jobs
- Transactional Outbox pattern
- Graceful shutdown and dependency readiness checks
- Structured logging with request IDs
- Prometheus metrics and Grafana dashboards
- k6 load testing
- PostgreSQL, Redis, API, and worker failure testing

---

## Architecture

```text
                         Client
                           │
                           ▼
                    ┌──────────────┐
                    │   Express    │
                    │     API      │
                    └──────┬───────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
            Reservation            Events
               Service
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   PostgreSQL  Redis    Outbox
        │        │        │
        │        │        ▼
        │        │      BullMQ
        │        │        │
        │        │        ▼
        │        │   Expiration Worker
        │        │
        └────────┴───────────────┐
                                 ▼
                            Observability
                           Prometheus/Grafana
````

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the detailed design.

---

## Core Reservation Flow

```text
Request
   │
   ▼
Validate request
   │
   ▼
Check Idempotency-Key
   │
   ▼
Lock event seat
   │
   ▼
Check availability
   │
   ▼
Seat → HELD
   │
   ▼
Reservation → PENDING
   │
   ├── Idempotency record
   ├── Expiration outbox event
   └── Cache invalidation event
   │
   ▼
Commit transaction
```

PostgreSQL is the source of truth for seat ownership.

Row-level locking ensures that concurrent requests targeting the same seat cannot both successfully reserve it.

---

## Reservation Lifecycle

```text
AVAILABLE
    │
    │ reserve
    ▼
  HELD
  /   \
 /     \
EXPIRED  CONFIRMED
   │        │
   ▼        │ cancel
AVAILABLE   ▼
          CANCELLED
              │
              ▼
          AVAILABLE
```

Temporary reservations expire after 10 minutes.

BullMQ delayed jobs perform expiration asynchronously.

---

## Reliability

The system uses the Transactional Outbox pattern:

```text
Database Transaction
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

This prevents asynchronous work from being lost if the publisher or API process fails after the database transaction commits.

---

## Idempotency

Every reservation requires an `Idempotency-Key`.

The system guarantees:

```text
Same key + same request
        ↓
Return original reservation

Same key + different request
        ↓
409 Conflict
```

Concurrent requests using the same key are handled safely and produce a single reservation.

---

## Redis

Redis is used for:

* Seat availability caching
* Cache-stampede protection
* Rate limiting

Redis is **not** the authoritative source for ticket ownership.

Seat allocation remains protected by PostgreSQL transactions and row locks.

---

## Observability

The API exposes:

```text
GET /metrics
```

Prometheus collects:

* HTTP request rate
* HTTP latency
* HTTP errors
* Reservation attempts
* Reservation successes
* Reservation conflicts
* Idempotent replays

Grafana is used to visualize the metrics.

Every request also receives an `X-Request-ID` for tracing through structured logs.

---

## Performance

Selected local benchmark results:

| Test                                |         Result |
| ----------------------------------- | -------------: |
| Lightweight endpoint @ 1,000 VUs    |   ~9,830 req/s |
| Seat reads @ 200 VUs                |   ~1,931 req/s |
| Seat reads @ 500 VUs                |   ~4,092 req/s |
| Seat reads @ 1,000 VUs              |   ~4,508 req/s |
| Seat read errors @ 1,000 VUs        |             0% |
| Reservation throughput @ 100 VUs    |     ~533 req/s |
| Reservation p95 @ 100 VUs           |         ~78 ms |
| 500 concurrent requests / 100 seats | 100 successful |
| Cache stampede p95 improvement      |           ~36% |

Detailed methodology and results are available in [LOAD_TESTING.md](./LOAD_TESTING.md).

---

## Failure Testing

The system has been tested against:

| Failure                  | Recovery                                       |
| ------------------------ | ---------------------------------------------- |
| PostgreSQL unavailable   | Readiness detects failure and recovers         |
| Redis unavailable        | Readiness detects failure and Redis reconnects |
| API process stopped      | Persisted reservation state survives           |
| Outbox publisher stopped | Pending events are processed after recovery    |

Detailed reproduction commands are available in [FAILURE_TESTING.md](./FAILURE_TESTING.md).

---

## Tech Stack

### Backend

* Node.js
* Express.js
* JavaScript / ES Modules

### Database

* PostgreSQL
* Drizzle ORM

### Infrastructure

* Redis
* BullMQ
* Docker Compose

### Validation & Testing

* Zod
* k6

### Observability

* Prometheus
* Grafana
* Structured logging

---

## Project Structure

```text
src/
├── config/
├── db/
├── modules/
│   ├── events/
│   ├── seats/
│   ├── reservations/
│   └── users/
├── queues/
├── outbox/
├── middleware/
├── utils/
├── app.js
└── server.js

tests/
└── load/

monitoring/
└── prometheus.yml

README.md
ARCHITECTURE.md
PLAN.md
LOAD_TESTING.md
FAILURE_TESTING.md
```

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Abhra0404/High-Traffic-Ticket-Reservation-System
cd high-traffic-ticket-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Configure environment

Create `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system
REDIS_URL=redis://localhost:6379
```

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Seed the database

```bash
npm run db:seed
```

### 7. Start the API

```bash
npm run dev
```

API:

```text
http://localhost:3000
```

---

## Useful Commands

### Start infrastructure

```bash
docker compose up -d
```

### Stop infrastructure

```bash
docker compose down
```

### Start API

```bash
npm run dev
```

### Start Outbox publisher

```bash
npm run outbox
```

### Database seed

```bash
npm run db:seed
```

### Database migrations

```bash
npm run db:migrate
```

### Database studio

```bash
npm run db:studio
```

### Run tests

```bash
npm test
```

### View containers

```bash
docker ps
```

---

## API Endpoints

### Events

```text
GET /api/events
GET /api/events/:id
GET /api/events/:id/seats
```

### Reservations

```text
POST /api/reservations
POST /api/reservations/:id/confirm
POST /api/reservations/:id/cancel
```

### Health

```text
GET /health/live
GET /health/ready
```

### Metrics

```text
GET /metrics
```

---

## Documentation

* [Architecture](./ARCHITECTURE.md)
* [Project Plan](./PLAN.md)
* [Load Testing](./LOAD_TESTING.md)
* [Failure Testing](./FAILURE_TESTING.md)

---

## Design Philosophy

The system deliberately avoids premature distributed-system complexity.

The implementation follows:

```text
Correctness
     ↓
Concurrency
     ↓
Performance
     ↓
Scalability
     ↓
Fault Tolerance
```

Technologies such as Kafka, Kubernetes, microservices, and cloud deployment are considered future evolution rather than requirements for the current system.

See [PLAN.md](./PLAN.md) for the roadmap.

---

## License

This project is licensed under the MIT License.

> Stay focused, stay productive, and keep leveling up! — kaizenX out. ✌️