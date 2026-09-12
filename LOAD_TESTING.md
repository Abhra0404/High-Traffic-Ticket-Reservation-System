# Load Testing — High-Traffic Ticket Reservation System

## Overview

Load testing was performed using [k6](https://k6.io/) to evaluate throughput, latency, concurrency behavior, and cache performance.

The tests were run against the local production-like stack:

- Node.js
- Express
- PostgreSQL
- Redis
- BullMQ

The goal was not to maximize a single benchmark number, but to identify bottlenecks and validate system behavior under increasing load.

---

## 1. Seat Read Performance

The seat availability endpoint was tested with increasing virtual users (VUs).

| VUs | Throughput | Avg Latency | p95 Latency | Errors |
|---:|---:|---:|---:|---:|
| 50 | ~464 req/s | 6.89 ms | 16.35 ms | 0% |
| 200 | ~1,931 req/s | 3.09 ms | 6.30 ms | 0% |
| 500 | ~4,092 req/s | 21.28 ms | 42.05 ms | 0% |
| 1,000 | ~4,508 req/s | 120.29 ms | 155.82 ms | 0% |

At 1,000 VUs, the system processed approximately 136K requests with no request errors.

---

## 2. Response Optimization

The seat endpoint initially returned unnecessary fields.

Response size was reduced from approximately:

```text
21.6 KB → 12.8 KB
````

This reduced network transfer by approximately 30% during the 1,000 VU test.

Observed improvement:

* Throughput: ~17.5% higher
* Average latency: ~24% lower
* p95 latency: ~15% lower

This demonstrated that network and serialization overhead became significant under high concurrency.

---

## 3. Cache Stampede Test

The test intentionally started with an empty Redis cache and generated concurrent seat requests.

### Without protection

Multiple requests simultaneously loaded seat data from PostgreSQL.

Observed:

* Average latency: ~309 ms
* p95 latency: ~415 ms

### With Redis lock

A Redis `SET NX EX` lock allowed one request to populate the cache while other requests waited for the result.

Observed:

* Average latency: ~238 ms
* p95 latency: ~266 ms

Approximate improvement:

* Average latency: ~23% lower
* p95 latency: ~36% lower

This validated the cache-stampede protection mechanism.

---

## 4. Reservation Throughput

Reservation requests involve database transactions and row-level locking, so they are substantially more expensive than cached reads.

With 100 concurrent users targeting unique seats:

```text
Requests:      100
Successful:    100
Errors:        0
Throughput:    ~533 req/s
Average:       ~62 ms
p95:           ~78 ms
```

This provides a baseline for transactional reservation performance.

---

## 5. High-Contention Reservation Test

A contention test used:

```text
500 concurrent requests
100 available seats
```

The expected behavior was that exactly 100 reservations would succeed.

Result:

```text
Successful reservations: 100
Conflicts:               400
Database reservations:   100
Held seats:              100
```

This validates that PostgreSQL row-level locking prevents double-booking under contention.

The HTTP 409 responses are expected business conflicts rather than system failures.

---

## 6. Lightweight Endpoint Benchmark

A minimal endpoint was tested separately to isolate Node.js/Express overhead.

At 1,000 VUs:

```text
Throughput:    ~9,830 req/s
Average:       ~1.06 ms
p95:           ~2.93 ms
Errors:        0%
```

This established that the heavier seat endpoint's bottleneck was not simply Express request handling.

---

## 7. Cluster Experiment

A four-worker Node.js cluster was tested against the seat endpoint.

Observed:

```text
Single process:
~3,838 req/s

Four workers:
~3,943 req/s
```

The improvement was small.

This indicated that simply adding Node.js workers did not remove the primary bottleneck for this workload.

The experiment reinforced the importance of measuring before introducing horizontal or process-level scaling.

---

## 8. Conclusions

The load tests demonstrated:

* Redis significantly improves repeated seat reads.
* Cache stampede protection reduces latency during cold-cache bursts.
* PostgreSQL row locking maintains reservation correctness under contention.
* Reservation transactions are considerably more expensive than cached reads.
* Response size has a measurable impact at high concurrency.
* Node.js/Express can handle substantially higher throughput on lightweight requests.
* Adding workers alone does not guarantee proportional scalability.

The current architecture therefore focuses on:

```text
PostgreSQL → correctness
Redis      → read performance
BullMQ     → asynchronous work
Outbox     → reliable event delivery
Prometheus → measurement
```

Further performance work should be driven by profiling and production workload characteristics rather than benchmark chasing.

