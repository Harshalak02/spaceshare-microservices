# Booking System Architecture Plan (Hourly Slot Model)

## 1. Scope
This plan defines booking architecture for small hourly reservations, not overnight stays.

Product behavior:
- Booking unit is fixed 1-hour slots.
- Guest can book multiple contiguous slots in one request.
- Host availability windows come from listing-service schedule rules.
- Guest sees calendar-style slot options and books selected slots.

## 2. Core Assumptions
1. slot_minutes = 60 for MVP.
2. requested slots must be contiguous.
3. booking request anchored by start_slot_utc + slot_count.
4. timezone display is handled by listing timezone in UI payload.
5. no overnight stay semantics in booking model.

## 3. Current State Gap
Current booking-service has start_time/end_time range overlap check, but lacks:
- explicit slot_count model
- slot-level persistence for strong uniqueness
- secure access for all booking read endpoints
- cancellation lifecycle and review flow aligned to hourly model

## 4. Architecturally Significant Requirements
### Functional
1. Prevent double booking at slot level under concurrency.
2. Support multi-slot contiguous booking.
3. Provide reservation data so listing slot timeline can hide reserved slots.
4. Preserve booking-platform behavior: cancel, status changes, reviews after completion.

### Non-functional
1. 200 concurrent request safety.
2. cache hit under 500 ms, cache miss under 1.5 sec for booking reads.
3. 99.99% availability target.

## 5. Domain Ownership
- listing-service owns availability rules and slot generation policy.
- booking-service owns reservation truth and occupancy.
- booking-service exposes reserved slot API for listing calendar composition.

## 6. Target Components
1. Booking API Module
- create/cancel/list/review endpoints.

2. Slot Reservation Engine
- validates slot alignment and contiguity.
- checks conflicts transactionally.

3. Listing Snapshot Adapter
- validates listing state, capacity, and policy before booking.

4. Pricing Engine
- computes subtotal from slot_count and price_per_hour snapshot.

5. Slot Persistence Module
- persists per-slot occupancy rows for conflict guarantees.

6. Event Module
- emits BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_COMPLETED.

## 7. Runtime Flow
### Flow A: Create Booking
1. Guest sends space_id, start_slot_utc, slot_count.
2. Service validates input and slot alignment (minute = 00).
3. Service fetches listing snapshot (status, capacity, price, policy).
4. Service computes requested slot sequence.
5. In transaction:
- checks slot occupancy conflicts
- inserts booking row
- inserts booking_slots rows
6. Commit and emit BOOKING_CONFIRMED for instant-book listings, else BOOKING_CREATED with pending status.

### Flow B: Cancel Booking
1. Caller authorization check.
2. status transition confirmed/pending -> cancelled.
3. release occupied slot rows from active occupancy set.
4. emit BOOKING_CANCELLED.

### Flow C: Reserved Slots API for Listing
1. listing-service requests reserved slots by listing and date range.
2. booking-service returns reserved slot windows in UTC.
3. listing-service overlays them on generated candidate slots.

Access assumption:
- reserved-slot endpoint is internal service-to-service only.

## 8. Concurrency Strategy
Preferred MVP approach:
- booking_slots table with unique constraint on (space_id, slot_start_utc) for active bookings.

Why:
- deterministic conflict control at DB level
- clearer behavior than only range-based app logic under race

## 9. Lifecycle Model
States:
- pending
- confirmed
- cancelled
- completed
- refunded

Transition examples:
- create -> confirmed (instant) or pending (approval flow)
- confirmed -> cancelled
- confirmed -> completed after end slot

## 10. Reliability and Observability
Metrics:
- booking_create_latency_ms
- slot_conflict_rate
- slot_insert_conflict_count
- cancellation_rate
- reserved_slot_query_latency

Logs:
- correlation_id
- booking_id, space_id, user_id, slot_count, status

## 11. Patterns and Tactics
Patterns:
- Slot-led reservation model
- State machine for booking lifecycle

Tactics:
- Transactional writes for booking and slot occupancy
- Cache-aside for booking list/detail reads
- strict validation and ownership checks

## 12. Out of Scope
- variable slot durations
- advanced dynamic pricing
- waitlist or queueing system for high-demand slots