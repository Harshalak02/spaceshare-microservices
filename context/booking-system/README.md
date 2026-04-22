# Booking System Documentation Index

Last synchronized with implementation: 2026-04-22

This folder documents the booking subsystem used by hourly reservations.

## Current implementation snapshot
- Booking requests are slot-based: start_slot_utc plus slot_count.
- Legacy start_time/end_time payloads are still accepted and translated for compatibility.
- Payment is attempted before booking persistence through booking-service payment bridge.
- Conflict safety is enforced by booking_slots active-slot unique index.
- Cancellation releases active slot occupancy and stores cancellation metadata.
- Internal reserved-slot endpoint is used by listing-service to compose slot timelines.
- Review submission endpoint is not implemented in current booking-service routes.

## Document map
1. architecture.md
- Runtime architecture, boundaries, ownership, and flow diagrams in text form.

2. design.md
- Module-level behavior, validations, lifecycle handling, and compatibility logic.

3. api-contracts.md
- Implemented endpoint contracts, payloads, error shapes, and emitted event contracts.

4. data-model.md
- Current schema, indexes, slot occupancy model, and migration-safe notes.

5. nfr-and-tactics.md
- Availability, performance, concurrency, and security tactics tied to implementation.

6. adrs.md
- Booking-specific architecture decisions and current status.

7. testing.md
- Practical test plan and executed E2E flow coverage.

8. roadmap.md
- Delivery phases with status markers for done/in-progress/backlog work.

Cross-cutting references:
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md