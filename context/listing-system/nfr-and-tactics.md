# Listing System NFRs and Tactics

Last synchronized with implementation: 2026-04-22

## 1. NFR targets
1. Correctness: schedule and override precedence must remain deterministic.
2. Performance: slot reads should benefit from short-lived cache.
3. Security: owner-only writes and authenticated gateway path.
4. Reliability: bounded dependency timeout when contacting booking-service.

## 2. NFR to tactic mapping
| NFR | Tactic | Current implementation |
|---|---|---|
| Latency | cache-aside | Redis slot cache with per-range keying and TTL |
| Throughput | bounded request range | max 31-day slot query enforcement |
| Correctness | deterministic precedence | override first, weekly fallback |
| Consistency | compose at read-time from source systems | schedule from DB + occupancy from booking-service |
| Security | layered auth and ownership checks | gateway JWT plus owner checks in listing-service |
| Resilience | dependency timeout | internal booking fetch timeout configuration |

## 3. Performance budget baseline
Slot cache miss path:
- validate request and listing lookup: 20-120 ms
- load weekly/override rules: 40-150 ms
- booking reserved-slot dependency call: 100-500 ms
- slot generation and serialization: 50-250 ms
- target: <= 1.5s p95

Slot cache hit path:
- target: <= 500 ms p95

## 4. Caching and freshness strategy
Key format:
- slots:listing:{id}:from:{from}:to:{to}:all:{0|1}

TTL:
- default 30 seconds (SLOT_CACHE_TTL_SECONDS)

Invalidation currently implemented:
- listing update/delete
- weekly schedule writes
- override writes/deletes

Freshness caveat:
- booking create/cancel does not currently trigger direct invalidation in listing-service.
- freshness after reservation changes depends on TTL expiry.

## 5. Security tactics
1. owner check for listing updates and availability mutations.
2. gateway authentication for /api/listings route family.
3. validation for timezone, date range, and time window inputs.

## 6. Risk register
Risk: stale slot availability during TTL window after booking changes.
- Mitigation: short TTL and optional future event-driven invalidation.

Risk: booking-service timeout affecting slot reads.
- Mitigation: strict timeout plus clear error path.

Risk: timezone/DST conversion issues.
- Mitigation: centralized luxon-based conversions and focused tests.

## 7. Current validation status
- End-to-end flows validated booking impact on slot reads in integrated test cycle.
- Formal load-test benchmark report not yet stored in repo docs.

## 8. References
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md