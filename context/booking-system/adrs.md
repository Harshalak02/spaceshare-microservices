# Booking System ADRs

Last synchronized with implementation: 2026-04-22

## ADR-B1: Canonical Slot-Based Create Payload
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Hourly reservations are clearer with explicit slot semantics than free-form ranges.

### Decision
Use start_slot_utc + slot_count as canonical create input.

### Consequences
Positive:
- pricing and capacity checks are straightforward.
- slot expansion is deterministic.

Negative:
- legacy clients needed compatibility support.

Implementation note:
- start_time/end_time payload remains accepted and converted.

## ADR-B2: Slot Occupancy as First-Class Table
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Range-only overlap logic is less reliable under race conditions.

### Decision
Persist one booking_slots row per reserved hour and enforce unique active slots per listing.

### Consequences
Positive:
- deterministic conflict handling under concurrent writes.

Negative:
- higher write volume proportional to slot_count.

## ADR-B3: Contiguous Slot Expansion in MVP
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Product flow and UI use contiguous hour blocks.

### Decision
slot_count expands from start_slot_utc in contiguous 60-minute increments.

### Consequences
Positive:
- simple UX and consistent pricing.

Negative:
- disjoint slot bundles require multiple bookings.

## ADR-B4: Internal Reserved-Slot Export
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
listing-service needs reservation truth to reconcile generated candidate slots.

### Decision
Expose internal endpoint for reserved slots by listing and date range.

### Consequences
Positive:
- clear ownership boundary between schedule rules and occupancy truth.

Negative:
- listing slot reads depend on booking-service availability/latency.

## ADR-B5: Payment Attempt Before Booking Persistence
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Booking rows should not be committed when payment is strictly required and fails.

### Decision
booking-service calls payment bridge before transaction commit path.

### Consequences
Positive:
- avoids dangling unpaid bookings in strict mode.

Negative:
- create latency includes payment dependency.

## ADR-B6: Keep Review Endpoint Out of Current Scope
- Status: Deferred (not implemented)
- Date: 2026-04-22

### Context
Current routes and service logic prioritize booking/cancel/payment-safe flow.

### Decision
Do not expose review create endpoint until completion lifecycle is fully implemented.

### Consequences
Positive:
- reduced scope and lower risk while stabilizing booking/payment integration.

Negative:
- post-stay review capability is unavailable in current release.