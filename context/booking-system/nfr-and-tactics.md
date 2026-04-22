# Booking System NFR Plan and Tactics (Hourly Slot Model)

## 1. NFR Targets
1. Availability consistency target: 99.99%.
2. Performance:
- cache hit under 500 ms
- cache miss under 1.5 sec
3. Concurrency safety for 200 simultaneous requests.
4. Scalability for 500 baseline and 2000 peak users.

## 2. NFR-to-Tactic Mapping
| NFR | Tactic | Implementation |
|---|---|---|
| Concurrency correctness | DB-enforced uniqueness | active slot unique index in booking_slots |
| Latency | cache-aside | cache booking lists and booking detail views |
| Throughput | pagination and bounded queries | list endpoints page_size cap |
| Availability | stateless scaling | multiple booking-service replicas |
| Security | strict authz | protect all user-specific and host-specific reads |
| Reliability | transaction boundaries | booking + slot occupancy commit atomically |

## 3. Performance Budgets
Create booking (cache miss path):
- validation and auth: 20-60 ms
- listing snapshot fetch: 100-300 ms
- transaction and slot inserts: 80-350 ms
- event publish overhead: 10-80 ms
- total target: <= 1.5 sec p95

Booking list read:
- cache hit <= 500 ms p95
- cache miss <= 1.5 sec p95

## 4. Concurrency Tactics
1. Use booking_slots active unique index to reject races.
2. Keep create flow inside a single DB transaction.
3. Use idempotency key in phase 2 to protect retries.

## 5. Security Tactics
1. Remove public access to user-specific booking endpoints.
2. Enforce ownership for guest and host list views.
3. Restrict internal reserved-slot endpoint.
4. Rate limit create/cancel/review endpoints.

## 6. Scalability Tactics
1. horizontally scale booking-service instances.
2. optimize indexes for space_id and slot_start_utc paths.
3. avoid N+1 queries in booking list APIs.

## 7. Capacity Tests
1. 200 concurrent create requests for same slot should yield one winner and conflict for others.
2. mixed workload with 2000 users should keep p95 latency within budget.

## 8. Patterns
Pattern 1: Slot-led reservation engine.
Pattern 2: Lifecycle state machine for bookings.

## 9. Risks and Mitigations
Risk: high contention on hot listings.
- Mitigation: precise indexes and conflict-aware UX messaging.

Risk: stale slot view due delayed invalidation.
- Mitigation: event-driven invalidation and short TTL.

Risk: migration complexity from range to slot model.
- Mitigation: additive rollout and compatibility mapping period.

## 10. Deep Analysis References
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md