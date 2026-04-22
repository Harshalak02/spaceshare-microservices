# Listing System Roadmap and Status

Last synchronized with implementation: 2026-04-22

## 1. Objective
Maintain stable slot-aware listing behavior while improving freshness, reliability, and documentation accuracy.

## 2. Phase status
### Phase L1: Availability foundation
Status: Completed

Delivered:
- timezone and slot_minutes support in spaces.
- weekly availability table and endpoints.
- date override table and endpoints.

### Phase L2: Slot timeline engine
Status: Completed

Delivered:
- dynamic one-hour slot generation.
- date-range validation with 31-day cap.
- timezone-aware local and UTC slot payload fields.

### Phase L3: Reservation overlay integration
Status: Completed (baseline)

Delivered:
- booking-service reserved-slot adapter.
- status overlay (available/reserved) in slot timeline.

Remaining:
- event-driven cache invalidation on booking create/cancel.

### Phase L4: Performance and hardening
Status: In progress

Delivered:
- Redis slot caching with configurable TTL.

Remaining:
- formal load/performance report artifacts.
- deeper timeout/retry/error-budget dashboards.

### Phase L5: Frontend integration
Status: Completed (core booking/search flow)

Delivered:
- search and slot-picker flow integrated with listing slot endpoint.
- E2E flow validated with booking creation and cancellation impact.

Remaining:
- full host schedule management UI maturity enhancements.

## 3. Dependencies
- booking-service internal reserved-slot endpoint availability.
- api-gateway auth policy for listing route family.
- Redis for cache storage.

## 4. Near-term backlog
1. Consume booking events in listing-service for proactive slot cache invalidation.
2. Add explicit reliability fallback strategy for booking overlay dependency failures.
3. Add benchmark and soak-test results to repository docs.

## 5. Milestone checklist
- [x] L1 availability schema and APIs
- [x] L2 slot engine
- [x] L3 reservation overlay baseline
- [ ] L4 full NFR hardening
- [x] L5 integrated slot flow in frontend

## 6. Course deliverable mapping
- Task 1: listing subsystem and ASR coverage through slot model docs.
- Task 2: ADR/stakeholder alignment captured in architecture artifacts.
- Task 3: tactics and pattern application for composed read model.
- Task 4: non-trivial flow validated end-to-end with booking impact on slots.