# Booking System Detailed Design (Hourly Slot Model)

## 1. Design Goals
1. Guarantee no duplicate reservation for any 1-hour slot.
2. Support contiguous multi-slot booking requests.
3. Keep booking APIs simple and explicit for slot semantics.
4. Integrate with listing-service schedule and policies.

## 2. Module Design
### 2.1 Request Validation Module
Validations:
- space_id required
- start_slot_utc required and aligned to hour boundary
- slot_count integer >= 1
- guest_count >= 1
- end derived as start + slot_count * 60 min

### 2.2 Listing Snapshot Adapter
Fetch and validate:
- listing exists and active
- capacity supports guest_count
- price_per_hour snapshot
- cancellation policy and instant book flag

### 2.3 Slot Sequencer
Responsibilities:
- expand request into contiguous slot windows
- example: start 10:00, slot_count 3 -> [10-11], [11-12], [12-13]

### 2.4 Conflict Guard
Responsibilities:
- check and reserve all requested slots atomically
- reject with BOOKING_CONFLICT if any slot occupied

Implementation:
- transactional insert into booking_slots with unique constraint
- conflict on unique index means slot already reserved

### 2.5 Pricing Engine
Computation:
- subtotal = slot_count * price_per_hour
- platform fee and taxes from config
- total stored as immutable snapshot values

### 2.6 Lifecycle and Policy Module
Responsibilities:
- state transitions
- cancellation window and refund logic
- completion marker after end slot

### 2.7 Reservation Export Module
Responsibilities:
- provide reserved slot ranges to listing-service for timeline overlay

## 3. Create Booking Sequence
1. Validate request.
2. Fetch listing snapshot.
3. Generate requested slot sequence.
4. Start DB transaction.
5. Insert booking row in pending/confirmed.
6. Insert each requested slot into booking_slots.
7. If any slot insert conflicts, rollback and return BOOKING_CONFLICT.
8. Commit, publish event, clear relevant caches.

## 4. Cancellation Sequence
1. Validate ownership and allowed state.
2. Compute refund based on policy and time-to-start.
3. Update booking status to cancelled.
4. Mark booking_slots rows as released (keep history for audit and analytics).
5. Publish cancellation event.

## 5. API Read Design
### Guest
- /bookings/my returns own bookings with slot_count and timing.

### Host
- /bookings/host/my returns bookings for owned listings.

### Internal
- /internal/listings/:id/reserved-slots returns occupied slot windows.

## 6. Security Design
1. Protect all booking read endpoints.
2. Enforce user ownership checks.
3. Enforce host ownership for host operations.
4. Restrict internal endpoints to trusted network/gateway token.

## 7. Error Codes
- BOOKING_VALIDATION_ERROR
- BOOKING_CONFLICT
- BOOKING_FORBIDDEN
- LISTING_UNAVAILABLE
- BOOKING_INVALID_STATE_TRANSITION
- DEPENDENCY_UNAVAILABLE

## 8. Rollout Strategy
1. Add new columns/tables and keep old range fields for compatibility.
2. Add slot_count-based create path.
3. Migrate frontend to slot_count request payload.
4. Deprecate loose range-path assumptions.

## 9. Open Decisions
1. pending approvals in MVP or phase 2 only?
2. should minimum booking slots be configurable per listing?
3. should maximum slot_count per booking be global or per listing?