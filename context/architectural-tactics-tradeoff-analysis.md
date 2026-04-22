# Architectural Tactics Tradeoff Analysis

## 1. Purpose
This document analyzes architectural tactics for SpaceShare's hourly slot model and explains why specific tactics are selected over alternatives for this use case.

## 2. NFR Targets
1. Availability: 99.99% target.
2. Performance:
- cache hit under 500 ms
- cache miss under 1.5 sec
3. Concurrency: safe behavior at 200 simultaneous requests.
4. Scalability: 500 baseline and 2000 peak users.
5. Security: JWT-based access and protected user data.

## 3. Tactics by Quality Attribute

### 3.1 Performance Tactics
#### Tactic A: Cache-Aside for slot timeline and booking reads (Chosen)
- Pros:
  - simple invalidation model
  - avoids write-path cache coupling
  - good fit for read-heavy timeline traffic
- Cons:
  - stale reads possible during invalidation lag
  - cache miss can be expensive

#### Tactic B: Read-Through cache
- Pros:
  - centralized cache behavior
  - potentially simpler client code
- Cons:
  - additional infrastructure complexity
  - less control over service-specific invalidation

Why A is chosen:
- Existing stack and service ownership are better matched by cache-aside.

#### Tactic A: On-demand slot generation + reservation overlay (Chosen)
- Pros:
  - no slot table explosion
  - immediate reaction to schedule edits
- Cons:
  - CPU cost on misses

#### Tactic B: Precomputed slot materialization
- Pros:
  - very fast reads
- Cons:
  - heavy storage and recomputation jobs
  - complex synchronization with cancellations

Why A is chosen:
- Host schedules can change often; on-demand generation keeps writes simple.

### 3.2 Availability Tactics
#### Tactic A: Stateless horizontal scaling with health probes (Chosen)
- Pros:
  - straightforward deployment and failover
  - low coupling to runtime platform details
- Cons:
  - does not alone solve regional outages

#### Tactic B: Multi-region active-active
- Pros:
  - stronger regional resilience
- Cons:
  - operationally expensive and consistency complexity

Why A is chosen:
- Project scope and complexity constraints favor single-region multi-instance architecture.

#### Tactic A: Timeouts + bounded retries for service dependencies (Chosen)
- Pros:
  - prevents request pileups
  - predictable latency behavior
- Cons:
  - retry policy tuning required

#### Tactic B: Unbounded retries
- Pros:
  - may recover some transient failures
- Cons:
  - can cascade failures and blow latency budgets

Why A is chosen:
- Bounded retries are necessary to preserve p95/p99 latency SLOs.

### 3.3 Concurrency and Consistency Tactics
#### Tactic A: DB-level unique active slot constraint + transaction (Chosen)
- Pros:
  - strongest deterministic conflict control
  - simpler race reasoning
- Cons:
  - lock/contention on hot slots

#### Tactic B: App-level overlap check only
- Pros:
  - less schema complexity
- Cons:
  - race windows under high concurrency

#### Tactic C: Distributed locks (Redis lock)
- Pros:
  - can serialize critical sections
- Cons:
  - operational fragility and lock expiry edge cases

Why A is chosen:
- Reservation correctness is critical; DB constraint is strongest and auditable.

### 3.4 Security Tactics
#### Tactic A: Defense in depth (gateway + service authz) (Chosen)
- Pros:
  - protects against misrouted traffic or gateway misconfig
  - enables service-level ownership checks
- Cons:
  - repeated logic unless centralized middleware policy is used

#### Tactic B: Gateway-only authorization
- Pros:
  - simpler service code
- Cons:
  - higher risk if gateway rules drift or bypass occurs

Why A is chosen:
- User booking data is sensitive; layered checks are justified.

### 3.5 Scalability Tactics
#### Tactic A: Query bounding and pagination (Chosen)
- Pros:
  - bounded memory and payload size
  - predictable response times
- Cons:
  - more client logic for pagination

#### Tactic B: unrestricted range queries
- Pros:
  - easy client usage
- Cons:
  - high risk of latency spikes and memory pressure

Why A is chosen:
- Required to keep slot and booking query performance stable at peak load.

### 3.6 Observability Tactics
#### Tactic A: Structured logs + metrics + correlation IDs (Chosen)
- Pros:
  - actionable debugging and SLO tracking
  - supports architecture analysis in report
- Cons:
  - instrumentation overhead

#### Tactic B: minimal logs only
- Pros:
  - low initial effort
- Cons:
  - weak diagnosability, poor analysis quality

Why A is chosen:
- Required for assignment quantification and operational confidence.

## 4. Cross-Tactic Interactions and Tradeoffs
1. Cache-aside + event invalidation improves latency but introduces staleness risk.
- Mitigation: short TTL and deterministic key invalidation.

2. DB uniqueness guarantees correctness but increases hot-key contention.
- Mitigation: optimize indexes and provide clear BOOKING_CONFLICT UX.

3. Composed read model increases dependency surface.
- Mitigation: strict timeout budgets and fallback policy.

4. Defense-in-depth improves security but adds repeated checks.
- Mitigation: shared middleware and policy helpers.

## 5. Chosen Tactics Summary
| Quality Attribute | Chosen Tactic | Why It Fits SpaceShare |
|---|---|---|
| Performance | cache-aside + on-demand slot generation | balances speed with manageable write complexity |
| Availability | stateless scaling + health checks + bounded retries | practical and robust for project scope |
| Concurrency | DB unique active slot constraint | strongest correctness for booking conflicts |
| Security | layered authn/authz | protects booking privacy and ownership boundaries |
| Scalability | bounded date windows + pagination | stable behavior under peak user load |
| Operability | structured telemetry | enables reliable analysis and debugging |

## 6. Deferred Tactics (Phase 2+)
1. Outbox pattern for stronger event delivery guarantees.
2. Circuit breaker per dependency call path.
3. Multi-region deployment for stronger regional resilience.

Reason for deferral:
- Adds significant operational complexity beyond prototype scope.

## 7. Implementation Guardrails
1. Do not ship booking create without DB-level slot conflict guarantees.
2. Do not allow unbounded slot date-range queries.
3. Ensure every critical endpoint emits latency and error metrics.
4. Keep fallback behavior explicit and testable.

## 8. Architecture Analysis Guidance for Report
For Task 4 comparison, compare chosen approach against one alternative, for example:
- Chosen: on-demand slot generation + cache-aside
- Alternative: precomputed slot materialization

Quantify at least:
1. p95 slot timeline latency
2. throughput at 200 concurrent requests
3. operational complexity tradeoff (qualitative + measured resource usage)

This provides a strong, defensible architecture analysis section in the final report.