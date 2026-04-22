# Booking System NFRs and Tactics

Last synchronized with implementation: 2026-04-22

## 1. Target NFRs
1. Availability consistency target: 99.99% for booking correctness path.
2. Concurrency correctness: no double-booking for same slot.
3. Performance target (service-level): create and list paths within acceptable UX budgets.
4. Security: all external booking endpoints require authenticated access.

## 2. NFR to tactic mapping
| NFR | Tactic | Current implementation |
|---|---|---|
| Concurrency correctness | DB uniqueness + transaction | booking_slots active partial unique index and transactional writes |
| Correctness under retry | idempotency key storage | idempotency_key column and unique index present |
| Dependency resilience | fail-fast payment/listing adapters | create flow aborts on required dependency failures |
| Security | gateway JWT + service checks | booking routes JWT-protected and ownership checks enforced |
| Traceability | event + state history | BOOKING_* events and booking_status_history table |

## 3. Performance budgets (planning baseline)
Create booking path:
- request validation/auth context: 20-80 ms
- listing snapshot fetch: 100-350 ms
- payment bridge: 100-500 ms
- DB transaction and slot inserts: 80-350 ms
- event publish: 10-80 ms
- overall target: <= 1.5s p95 in local/staging conditions

Booking read paths:
- my bookings and host bookings target <= 1.5s p95

## 4. Concurrency tactics
1. active-slot unique index blocks overlapping reservations at write time.
2. create booking uses single transaction for booking row + slot rows.
3. cancellation flips occupancy_status to released so slots reopen safely.

## 5. Security tactics
1. JWT protection at gateway for /api/bookings/*.
2. self/admin guard for /bookings/:user_id.
3. guest/host ownership guard on cancel.
4. optional internal token guard for reserved-slot endpoint.

## 6. Reliability and risk notes
Risk: payment dependency outage can block booking create.
- Mitigation: configurable enforcement mode and explicit failure path.

Risk: listing snapshot latency affects create latency.
- Mitigation: strict validation scope and fail-fast behavior.

Risk: high contention on hot listings.
- Mitigation: deterministic conflict handling and client-side retry UX.

## 7. Measured/validated status in current cycle
- API E2E flow was validated for register/login/listing/slot/booking/conflict/payment/cancel/release.
- Conflict behavior and cancellation slot release were observed as functioning.

## 8. Residual gaps
1. no formal load-test report attached in repository docs.
2. no structured error code schema in API responses.
3. review/completion lifecycle remains outside current implementation.

## 9. References
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md