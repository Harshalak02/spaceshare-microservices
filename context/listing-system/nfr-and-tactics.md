# Listing System NFR Plan and Tactics (Hourly Slot Model)

## 1. NFR Targets
1. Availability consistency target: 99.99%.
2. Slot timeline performance:
- cache hit under 500 ms
- cache miss under 1.5 sec
3. Security: JWT-authenticated host writes and protected owner operations.
4. Concurrency: support 200 simultaneous requests.
5. Scalability: 500 baseline users and 2000 peak users.

## 2. NFR-to-Tactic Mapping
| NFR | Tactic | Implementation |
|---|---|---|
| Latency | cache-aside | cache slot timelines by listing and date range |
| Throughput | bounded query range | max 31-day slot timeline query window |
| Availability | dependency timeout + fallback | short timeout for reservation overlay call |
| Security | defense in depth | gateway JWT plus service-level authorization |
| Scalability | stateless horizontal scale | replicate listing-service instances |
| Correctness | deterministic rule precedence | override first, weekly fallback |

## 3. Performance Budgets
Slot timeline path budget (cache miss):
- auth and request validation: 20-60 ms
- fetch weekly + overrides: 40-120 ms
- fetch reserved slots from booking-service: 100-300 ms
- slot generation + merge: 50-200 ms
- total target: <= 1.5 sec p95

Slot timeline cache hit budget:
- total target: <= 500 ms p95

## 4. Caching Strategy
Cache keys:
- slots:listing:{id}:from:{date}:to:{date}

TTL:
- 30-120 seconds for slot payloads (tune by traffic profile)

Invalidation triggers:
- schedule updates
- override updates
- booking created/cancelled events

## 5. Reliability Tactics
1. Degrade gracefully when reservation overlay fails:
- either return 503 for strict correctness
- or return stale cache with stale marker (feature flag)
2. Alert on dependency error bursts.
3. Keep slot generation pure and deterministic for testability.

## 6. Security Tactics
1. Only host owner can mutate schedule.
2. Slot reads only for active listings.
3. Input validation on timezone, dates, and time windows.
4. Rate limit heavy slot-range reads.

## 7. Capacity Test Targets
1. 200 concurrent slot timeline requests for same listing/date range.
2. 2000 user mixed scenario with search + slot reads.

Success criteria:
- p95 cache hit under 500 ms
- p95 cache miss under 1.5 sec
- no elevated 5xx rates during burst

## 8. Patterns
Pattern 1: Rule-based availability engine.
Pattern 2: Composed read model (listing rules + reservation occupancy).

## 9. Risks and Mitigations
Risk: stale slots from delayed invalidation.
- Mitigation: short TTL plus event-driven invalidation.

Risk: timezone conversion edge cases.
- Mitigation: centralized timezone utility and DST-focused tests.

Risk: large slot payload size.
- Mitigation: date range cap and optional include_unavailable flag.

## 10. Deep Analysis References
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md