# SpaceShare V1 System Fixes — Implementation Plan

> **Date:** April 24, 2026  
> **Scope:** All critical and high-priority fixes identified in `v1_system_report.md`  
> **Constraint:** No external message queues (Kafka/RabbitMQ). All patterns use PostgreSQL + Redis only.

---

## Revised Capacity Estimation (50,000 users)

| Parameter | Value |
|-----------|-------|
| Total registered users | 50,000 |
| Peak concurrent users (10%) | 5,000 |
| Sessions per user per day | 1.5 |
| Actions per session | 12 |
| Read:Write ratio | 20:1 |
| Booking conversion rate | 5% of sessions |

### Traffic Numbers

```
Daily sessions           = 50,000 × 1.5    = 75,000 sessions/day
Daily requests           = 75,000 × 12     = 900,000 requests/day
Daily bookings           = 75,000 × 0.05   = 3,750 bookings/day

Average QPS (total)      = 900,000 / 86,400 ≈ 10.4 QPS
Average QPS (reads)      = 10.4 × (20/21)  ≈ 9.9 QPS
Average QPS (writes)     = 10.4 × (1/21)   ≈ 0.5 QPS

Peak burst (5,000 concurrent users in 60s window):
Burst QPS (total)        = 5,000 × 12 / 60 = 1,000 QPS
Burst QPS (reads)        = 1,000 × (20/21) ≈ 952 QPS
Burst QPS (writes)       = 1,000 × (1/21)  ≈ 48 QPS
Peak booking writes/sec  ≈ 5,000 × 0.05 / 60 ≈ 4.2 bookings/sec
```

### Infrastructure Requirements

| Resource | Sizing |
|----------|--------|
| DB pool per service | max: 30, idle timeout: 30s, connect timeout: 5s |
| Express concurrency | ~500 req/s per instance → need 2-3 instances behind LB |
| Redis | Single instance sufficient (100K+ ops/s capacity) |
| Booking DB write throughput | ~48 writes/sec → well within PG capacity with proper pooling |

---

## Fix Checklist

### Fix 1: Booking State Machine Guards
**File:** `booking-service/src/services/bookingService.js`  
**Problem:** `updateBookingStatus()` accepts any transition (e.g., cancelled → confirmed).  
**Solution:** Add a `VALID_TRANSITIONS` map and validate before updating.

### Fix 2: Re-enable Stale Pending Booking Cleanup  
**File:** `booking-service/server.js`  
**Problem:** Background cleanup interval is commented out — abandoned pending bookings block slots forever.  
**Solution:** Uncomment and harden with jitter + event publishing.

### Fix 3: Connection Pool Tuning  
**Files:** `booking-service/src/models/db.js`, `payment-service/src/models/db.js`, `listing-service/src/models/db.js`  
**Problem:** Default pool sizes (~10) are insufficient for 5,000 concurrent users.  
**Solution:** Configure `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`.

### Fix 4: Circuit Breaker on Inter-Service HTTP Calls  
**File:** `booking-service/src/utils/circuitBreaker.js` (NEW)  
**Files modified:** `booking-service/src/services/bookingService.js`  
**Problem:** If listing-service is down, booking requests hang until timeout with no recovery logic.  
**Solution:** Implement a lightweight circuit breaker (no external dependency) wrapping `fetchListingSnapshot`.

### Fix 5: Retry with Exponential Backoff  
**File:** `booking-service/src/utils/retry.js` (NEW)  
**Problem:** Transient network failures cause immediate user-facing errors.  
**Solution:** Add retry utility with exponential backoff + jitter for inter-service calls.

### Fix 6: Rate Limiting at API Gateway  
**File:** `api-gateway/src/middleware/rateLimiter.js` (NEW)  
**Files modified:** `api-gateway/src/app.js`, `api-gateway/src/routes/gatewayRoutes.js`  
**Problem:** No protection against abuse, bots, or accidental DDoS.  
**Solution:** In-memory sliding-window rate limiter (no external dependency) with per-user and global limits.

### Fix 7: Request Correlation IDs  
**File:** `booking-service/src/middleware/correlationMiddleware.js` (NEW)  
**Files modified:** `booking-service/src/app.js`, `api-gateway/src/app.js`  
**Problem:** No way to trace a request across services.  
**Solution:** Generate UUID correlation ID at gateway, forward through all services, include in logs.

### Fix 8: Outbox Pattern for Reliable Event Publishing  
**File:** `booking-service/schema.sql` (add outbox table)  
**File:** `booking-service/src/services/outboxPublisher.js` (NEW)  
**Files modified:** `booking-service/src/services/bookingService.js`  
**Problem:** Events published after COMMIT — if process crashes between COMMIT and publish, events are lost.  
**Solution:** Insert events into an `outbox_events` table within the same transaction. A background poller publishes and marks delivered. No external queue needed.

### Fix 9: Health Check Aggregation  
**File:** `api-gateway/src/app.js`  
**Problem:** Gateway health check only reports its own status, not downstream services.  
**Solution:** Aggregate health from all downstream services with timeout.

### Fix 10: Booking Query Pagination  
**File:** `booking-service/src/services/bookingService.js`  
**Files modified:** `booking-service/src/controllers/bookingController.js`  
**Problem:** `getBookingsByUser` and `getBookingsByHost` return unbounded result sets.  
**Solution:** Add LIMIT/OFFSET pagination with configurable page size.

---

## File Change Matrix

| File | Action | Fixes |
|------|--------|-------|
| `booking-service/src/services/bookingService.js` | MODIFY | #1, #4, #5, #8, #10 |
| `booking-service/src/controllers/bookingController.js` | MODIFY | #10 |
| `booking-service/src/app.js` | MODIFY | #7 |
| `booking-service/src/models/db.js` | MODIFY | #3 |
| `booking-service/server.js` | MODIFY | #2, #8 |
| `booking-service/schema.sql` | MODIFY | #8 |
| `booking-service/src/utils/circuitBreaker.js` | NEW | #4 |
| `booking-service/src/utils/retry.js` | NEW | #5 |
| `booking-service/src/middleware/correlationMiddleware.js` | NEW | #7 |
| `booking-service/src/services/outboxPublisher.js` | NEW | #8 |
| `payment-service/src/models/db.js` | MODIFY | #3 |
| `listing-service/src/models/db.js` | MODIFY | #3 |
| `api-gateway/src/app.js` | MODIFY | #7, #9 |
| `api-gateway/src/middleware/rateLimiter.js` | NEW | #6 |
| `api-gateway/src/routes/gatewayRoutes.js` | MODIFY | #6 |

---

## Implementation Order

1. **Fix 3** — Connection pool tuning (foundation, all DBs)
2. **Fix 1** — State machine guards (correctness, booking)
3. **Fix 2** — Stale booking cleanup (correctness, booking)
4. **Fix 5** — Retry utility (dependency for Fix 4)
5. **Fix 4** — Circuit breaker (resilience, booking)
6. **Fix 8** — Outbox pattern (reliability, booking)
7. **Fix 10** — Pagination (scalability, booking)
8. **Fix 7** — Correlation IDs (observability, all)
9. **Fix 6** — Rate limiting (protection, gateway)
10. **Fix 9** — Health check aggregation (ops, gateway)

---

## Testing Plan

### End-to-End Test Script
A comprehensive test script (`booking-service/test/e2e.test.js`) will be created to validate:

1. **State machine:** Attempt invalid transitions (cancelled → confirmed) and verify rejection
2. **Idempotency:** Send duplicate booking with same idempotency key
3. **Double-booking prevention:** Concurrent booking of same slot
4. **Pagination:** Verify bounded result sets
5. **Circuit breaker:** Verify behavior when listing service is unreachable
6. **Rate limiting:** Verify 429 responses after exceeding limits
7. **Correlation IDs:** Verify presence in response headers
8. **Health check:** Verify aggregated health endpoint
9. **Outbox:** Verify events are written to outbox table on booking creation
10. **Stale cleanup:** Verify expired pending bookings are cleaned up
