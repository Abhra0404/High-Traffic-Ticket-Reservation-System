# High-Traffic Ticket Reservation System

A production-oriented ticket reservation backend built to handle **high traffic, concurrent bookings, and sudden traffic spikes** while maintaining strict inventory consistency.

The project focuses on backend engineering and distributed-systems concepts rather than frontend development.

## Overview

Ticket reservation systems face a fundamental challenge:

> Many users may attempt to reserve the same limited inventory simultaneously.

The system must prevent:

* Double booking
* Overselling
* Race conditions
* Duplicate requests
* Inconsistent reservation states

while remaining performant under heavy traffic.

The project starts as a modular backend and progressively evolves into a scalable distributed architecture.

## Architecture

### Initial Architecture

```text
                    Client
                      │
                      ▼
                ┌───────────┐
                │  Express  │
                │    API    │
                └─────┬─────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Events       Seats    Reservations
          │           │           │
          └───────────┼───────────┘
                      ▼
                 PostgreSQL
```

### Target Architecture

```text
                     Clients
                        │
                        ▼
                 Load Balancer
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
            API-1     API-2     API-3
              │         │         │
              └─────────┼─────────┘
                        ▼
                      Redis
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
       Reservation    Event      Payment
          Logic       Logic       Logic
              │
              ▼
          PostgreSQL
              │
              ▼
          BullMQ Queue
              │
        ┌─────┼─────┐
        ▼     ▼     ▼
     Workers Workers Workers
```

The architecture will evolve gradually as scalability and consistency requirements increase.

## Core Features

* Event management
* Seat inventory management
* Ticket reservations
* Temporary seat holds
* Reservation expiration
* Concurrent booking protection
* Database transactions
* Idempotent requests
* Redis caching and coordination
* Background job processing
* Rate limiting
* Retry and failure handling
* Load testing
* Metrics and observability

## Tech Stack

| Layer        | Technology           |
| ------------ | -------------------- |
| Language     | JavaScript           |
| Runtime      | Node.js              |
| Framework    | Express.js           |
| Database     | PostgreSQL           |
| ORM          | Drizzle ORM          |
| Cache        | Redis                |
| Queue        | BullMQ               |
| Validation   | Zod                  |
| Containers   | Docker               |
| Load Testing | k6                   |
| Testing      | Vitest               |
| Monitoring   | Prometheus + Grafana |

## Project Structure

```text
src/
├── config/
│
├── db/
│   ├── index.js
│   └── schema.js
│
├── modules/
│   ├── events/
│   ├── seats/
│   ├── reservations/
│   └── users/
│
├── middleware/
├── utils/
│
└── server.js

tests/
```

The application initially follows a **modular monolith architecture**. Each domain is separated into modules while remaining part of the same Node.js application.

## Reservation Lifecycle

```text
AVAILABLE
    │
    ▼
  HELD
    │
    ├── Payment Failed ──► AVAILABLE
    │
    └── Payment Success
             │
             ▼
           SOLD
```

A temporary hold prevents another user from acquiring the seat while payment is being processed.

## Concurrency Challenge

The central engineering problem:

```text
User A ──┐
User B ──┤
User C ──┼──► Seat A12
User D ──┤
User E ──┘
```

Even if thousands of requests arrive simultaneously:

```text
Successful reservations = 1
Duplicate reservations  = 0
Overselling             = 0
```

The project will investigate:

* Database transactions
* Row-level locking
* Isolation levels
* Optimistic concurrency
* Pessimistic concurrency
* Redis-based coordination

## High-Traffic Testing

The system will be tested under progressively increasing workloads:

```text
Normal Traffic
      │
      ▼
Traffic Spike
      │
      ▼
Flash Sale
      │
      ▼
Massive Concurrent Booking
      │
      ▼
Failure + Recovery
```

Key metrics:

* Requests/sec
* p50 latency
* p95 latency
* p99 latency
* Error rate
* Database utilization
* Redis throughput
* Queue latency
* Worker throughput

## Failure Scenarios

The system will intentionally be tested against:

* Duplicate requests
* Concurrent reservations
* Worker crashes
* Database failures
* Redis failures
* Payment failures
* Network timeouts
* Message retries
* Expired reservations
* Partial transaction completion

The goal is to make the system **correct under failure**, not simply fast under normal conditions.

## Development Roadmap

### V1 — Core Reservation Engine

* Project setup
* Express API
* PostgreSQL
* Database schema
* Events
* Seats
* Reservations
* Basic transactions

### V2 — Concurrency & Consistency

* Race-condition testing
* Row-level locking
* Transaction isolation
* Double-booking prevention
* Concurrent load tests

### V3 — Redis

* Redis integration
* Seat holds
* Expiration
* Caching
* Rate limiting

### V4 — Asynchronous Processing

* BullMQ
* Background workers
* Payment processing
* Notifications
* Retries
* Dead-letter handling

### V5 — High-Traffic Architecture

* Horizontal API scaling
* Load balancing
* Database optimization
* Connection pooling
* Hot-inventory handling

### V6 — Production Engineering

* Idempotency
* Outbox pattern
* Failure recovery
* Observability
* Prometheus
* Grafana
* Comprehensive load testing

## Running Locally

### Install dependencies

```bash
npm install
```

### Start infrastructure

```bash
docker compose up -d
```

### Configure environment

Create `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system
```

### Run migrations

```bash
npm run db:generate
npm run db:migrate
```

### Start the server

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

## Engineering Philosophy

The system will not begin with a complex distributed architecture.

Each component will be introduced when a measurable problem requires it:

**Correctness → Concurrency → Performance → Scalability → Fault Tolerance**

This makes the project an engineering experiment rather than a collection of technologies.

## License

MIT
